import jwt from 'jsonwebtoken';

export default (req, res, next) => {
  if (process.env.DEBUG && req.query.authorization) {
    req.user = JSON.parse(req.query.authorization);
    next();
    return;
  }

  let token = req.headers.authorization;
  if (!token) {
    next({ status: 401, message: 'Unauthorized' });
    return;
  }

  if (!token.startsWith('Bearer ')) {
    next({ status: 401, message: 'Only bearer authentication is allowed' });
    return;
  }
  token = token.substring(7);

  jwt.verify(token, process.env.jwtKey, { algorithms: ['HS512'] }, (err, data) => {
    if (err) {
      next({ status: 401, message: 'Supplied token is invalid' });
      return;
    }

    if (!data) {
      next({ status: 401, message: 'Invalid token payload' });
      return;
    }

    req.user = data;
    next();
  });
};
