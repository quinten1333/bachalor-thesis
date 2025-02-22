import { Router } from 'express';
import { rgraphql } from '../../../libraries/amqpmessaging/index.js';

const loginRouter = Router();

loginRouter.post('/', async (req, res, next) => {
  if (!req.body.email ||!req.body.password) {
    next({ status: 401, message: 'No email or password supplied' });
    return;
  }

  const result = await rgraphql('api-user', 'query($email:String!,$password:String!) { apiToken(email:$email, password:$password) }', { email: req.body.email, password: req.body.password });

  res.send(result);
});

export default loginRouter;
