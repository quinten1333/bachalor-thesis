import mongoose from 'mongoose';
import debugLib from 'debug';

const debug = debugLib('entity_service:database');
let conn;

const entitySchema = new mongoose.Schema({
  name: String,
  description: String,
  type: { type: String, enum: ['company', 'research'] },
  contact: [new mongoose.Schema({
    type: { type: String, enum: ['website', 'email', 'phonenumber'] },
    content: String,
  })],
  external_id: { type: Number, index: true },
});
entitySchema.virtual('enid').get(function () { return this._id; }); // Create _id alias

export let Entity;

export const connect = async (uri) => {
  const conStr = uri || process.env.mongodbConStr || 'mongodb://mongodb/entity_service';
  conn = await mongoose.createConnection(conStr).asPromise();
  debug(`Connected to database: ${conStr}`);

  Entity = conn.model('Entity', entitySchema);
  return conn;
}

export const disconnect = async () => {
  await conn.close();
}
