import request from 'supertest';
import { IMessage } from '../src/models/message';
import app from '../src/app';
import repository from '../src/models/messageRepository';
import accountsApp from '../../accounts-service/src/app';
import {beforeAll, afterAll, describe, it, expect, jest} from '@jest/globals';
import { MessageStatus } from '../src/models/messageStatus';
import { IAccountEmail } from '../../accounts-service/src/models/accountEmail';

const testEmail = 'jest@jest.test.com';
const testEmail2 = 'jest2@jest.test.com'; 
const testPassword = '123456';
let jwt:string = '';
let testAccountId: number = 0;
let testAccountEmailId: number = 0;
let testMessageId: number = 0;
let testMessageId2: number = 0;

beforeAll(async ()=>{
    jest.setTimeout(10000);
    //Inicio criação account
    const testAccount = {
        name: 'Jest',
        email: testEmail,
        password: testPassword,
        domain: 'jest.test.com'
    }
    const accountResponse = await request(accountsApp)
                          .post('/accounts/')
                          .send(testAccount);
    console.log(`accountResponse: ${accountResponse.status}`);
    testAccountId = accountResponse.body.id;
    
    //Login da account criada
    const loginResponse = await request(accountsApp)
            .post('/accounts/login')
            .send({
                email: testEmail,
                password: testPassword
            });
    console.log(`loginResponse: ${loginResponse.status}`);
    jwt = loginResponse.body.token;
    //Fim do login

    const testAccountEmail: IAccountEmail = {
        name: 'Jest',
        email: testEmail,
        accountId: testAccountId
    }
    const accountEmailResponse = await request(accountsApp)
        .put('/accounts/settings/accountEmails')
        .send(testAccountEmail)
        .set('x-access-token',jwt);
    console.log(`accountEmailResponse: ${accountEmailResponse.status}`);
    if(accountEmailResponse.status != 201) throw new Error();
    testAccountEmailId = accountEmailResponse.body.id;    

    //Criação da Message
    const testMessage = {
        accountId: testAccountId,
        body: "corpo da mensagem",
        subject: "assunto da mensagem",
        accountEmailId: testAccountEmailId
    } as IMessage;

    const addResult = await repository.add(testMessage, testAccountId);
    console.log(`addResult ${addResult}`);
    testMessageId = addResult.id!;
    //Fim criação da Message
})

afterAll(async ()=> {
    jest.setTimeout(10000);

    const removeResult = await repository.removeById(testMessageId,testAccountId);
    const removeResult2 = await repository.removeById(testMessageId2,testAccountId);
    console.log(`removeResult: ${removeResult}:${removeResult2}`);

    const deleteAccountEmailResponse = await request(accountsApp)
        .delete(`/accounts/settings/accountEmails/${testAccountEmailId}/?force=true`)
        .set('x-access-token',jwt);
    console.log(`deleteAccountEmailResponse: ${deleteAccountEmailResponse.status}`);    

    //remove a account criada no teste
    const deleteAccountResponse = await request(accountsApp)
                                .delete(`/accounts/${testAccountId}?force=true`)
                                .set('x-access-token',jwt);
    console.log(`deleteAccountResponse: ${deleteAccountResponse.status}`);
    
    //faz logout
    const logoutResponse = await request(accountsApp)
                                .post('/accounts/logout')
                                .set('x-access-token',jwt);
    console.log(`logoutResponse: ${logoutResponse.status}`)
})

describe('Testando rotas do messages',()=>{
    
    //Retorna as mensagens da account autenticada
    it('GET /messages/ - Deve retornar statusCode 200', async() => {
        const resultado = await request(app)
            .get('/messages/')
            .set('x-access-token',jwt);
        
        expect(resultado.status).toEqual(200);
        expect(Array.isArray(resultado.body)).toBeTruthy();    
    }),

    //Retorna erro de autenticação
    it('GET /messages/ - Deve retornar statusCode 401', async() => {
        const resultado = await request(app)
            .get('/messages/');
        
        expect(resultado.status).toEqual(401);
    }),    
    
    //Retorna uma mensagem específica da account autenticada
    it('GET /messages/:id - Deve retornar statusCode 200', async() => {
        const resultado = await request(app)
            .get('/messages/'+testMessageId)
            .set('x-access-token',jwt);
        
        expect(resultado.status).toEqual(200);
        expect(resultado.body.id).toEqual(testMessageId);    
    }),

    //Retorna erro de autenticação
    it('GET /messages/:id - Deve retornar statusCode 401', async() => {
        const resultado = await request(app)
            .get('/messages/'+testMessageId);
        
        expect(resultado.status).toEqual(401);
    }),
    
    //Retorna erro de id inválido
    it('GET /messages/:id - Deve retornar statusCode 400', async() => {
        const resultado = await request(app)
            .get('/messages/abc')
            .set('x-access-token',jwt)
        
        expect(resultado.status).toEqual(400);
    }),

    //Retorna erro de id inexistente
    it('GET /messages/:id - Deve retornar statusCode 404', async() => {
        const resultado = await request(app)
            .get('/messages/-1')
            .set('x-access-token',jwt)
            
        expect(resultado.status).toEqual(404);
    }),
    
    //Retorna ok created para mensagem cadastrada
    it('POST /messages/ - Deve retornar statusCode 201', async() => {
        
        const payload = {
            accountId: testAccountId,
            body: 'Outro Corpo da mensagem',
            subject: 'Outro Assunto da mensagem',
            accountEmailId: testAccountEmailId
        } as IMessage

        const resultado = await request(app)
            .post('/messages/')
            .set('x-access-token',jwt)
            .send(payload);
        
        testMessageId2 = resultado.body.id;    
        expect(resultado.status).toEqual(201);
        expect(resultado.body.id).toBeTruthy();
    }),

    //Retorna erro de entidade não processada, objeto incorreto
    it('POST /messages/ - Deve retornar statusCode 422', async() => {
        
        const payload = {
            street: 'Minha rua!'
        }

        const resultado = await request(app)
            .post('/messages/')
            .set('x-access-token',jwt)
            .send(payload);
        
        expect(resultado.status).toEqual(422);
    }),
    
    //Retorna acesso não autorizado
    it('POST /messages/ - Deve retornar statusCode 401', async() => {
        
        const payload = {
            accountId: testAccountId,
            body: 'Outro Corpo da mensagem',
            subject: 'Outro Assunto da mensagem',
        } as IMessage

        const resultado = await request(app)
            .post('/messages/')
            .send(payload);
        
        expect(resultado.status).toEqual(401);
    })
    
    //Mensagem alterada com sucesso
    it('PATCH /messages/:id - Deve retornar statusCode 200', async() => {
        const payload = {
            subject: 'Subject alterado'
        }
        
        const resultado = await request(app)
            .patch('/messages/'+testMessageId)
            .set('x-access-token',jwt)
            .send(payload);
        
        expect(resultado.status).toEqual(200);
        expect(resultado.body.subject).toEqual(payload.subject);    
    }),
    
    //Erro ao alterar mensagem sem token
    it('PATCH /messages/:id - Deve retornar statusCode 401', async() => {
        const payload = {
            subject: 'Subject alterado'
        }
        
        const resultado = await request(app)
            .patch('/messages/'+testMessageId)
            .send(payload);
        
        expect(resultado.status).toEqual(401);
    })

    //Erro ao alterar mensagem mandando objeto inválido
    it('PATCH /messages/:id - Deve retornar statusCode 422', async() => {
        const payload = {
            street: 'Rua Prefeito José Guida'
        }
        
        const resultado = await request(app)
            .patch('/messages/'+testMessageId)
            .set('x-access-token',jwt)
            .send(payload);
        
        expect(resultado.status).toEqual(422);
    }),
    
    //Erro ao alterar passando um id de contato inválido
    it('PATCH /messages/:id - Deve retornar statusCode 404', async() => {
        const payload = {
            subject: 'Subject Alterado'
        }
        
        const resultado = await request(app)
            .patch('/messages/-1')
            .set('x-access-token',jwt)
            .send(payload);
        
        expect(resultado.status).toEqual(404);
    })
    
    //Erro quando é passado um parâmetro num formato inválido
    it('PATCH /messages/:id - Deve retornar statusCode 400', async() => {
        const payload = {
            subject: 'Subject Alterado'
        }
        
        const resultado = await request(app)
            .patch('/messages/abc')
            .set('x-access-token',jwt)
            .send(payload);
        
        expect(resultado.status).toEqual(400);
    }),
    
    //Mensagem excluida com sucesso, soft delete
    it('DELETE /messages/:id - Deve retornar statusCode 200', async() => {
        const resultado = await request(app)
            .delete('/messages/'+testMessageId)
            .set('x-access-token',jwt);    
 
        expect(resultado.status).toEqual(200);
        expect(resultado.body.status).toEqual(MessageStatus.REMOVED);
    }),

    //Mensagem excluida com sucesso, hard delete, no banco
    it('DELETE /messages/:id?force=true - Deve retornar statusCode 204', async() => {
        const resultado = await request(app)
            .delete(`/messages/${testMessageId}?force=true`)
            .set('x-access-token',jwt);
 
        expect(resultado.status).toEqual(204);
    }),    

    //Erro ao excluir uma mensagem, id inválido
    it('DELETE /messages/:id - Deve retornar statusCode 403', async() => {
        const resultado = await request(app)
            .delete('/messages/-1')
            .set('x-access-token',jwt);
        
        expect(resultado.status).toEqual(403);
    })    
})