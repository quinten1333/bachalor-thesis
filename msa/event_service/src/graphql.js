import { graphql } from 'graphql';
import { schemaComposer } from 'graphql-compose';
import { readFileSync } from 'fs';

import { rgraphql } from '../../libraries/amqpmessaging/index.js';
import { Event } from './database.js';
import { canGetEvent, canGetEvents } from './permissions.js';

const checkEntitiesExist = async (entities) => {
  const res = await rgraphql('api-entity', 'query($enids: [ID!]!){entities(enids:$enids){enid}}', { enids: entities });
  if (res.errors) {
    console.error('Checking entities failed', res.errors);
    throw new Error('Unexpected error occured while checking if entities exist');
  }

  const enids = res.data.entities.map((entity) => entity ? entity.enid : null);
  for (const enid of entities) {
    if (!enids.includes(enid)) {
      throw new Error(`Entity ${enid} does not exist!`);
    }
  }
}

schemaComposer.addTypeDefs(readFileSync('./src/schema.graphql').toString('utf8'));

schemaComposer.Query.addNestedFields({
  event: {
    type: 'Event',
    args: {
      evid: 'ID!',
    },
    description: JSON.stringify({
      permissionCheck: canGetEvent.toString(),
      caching: { type: 'event', key: 'evid' }
    }),
    resolve: async (obj, args, req) => {
      const event = await Event.findById(args.evid);
      if (!event) { return null; }
      canGetEvent(req, args, event);
      return event;
    },
  },
  events: {
    type: '[Event!]',
    args: {
      all: 'Boolean',
    },
    description: JSON.stringify({
      permissionCheck: canGetEvents.toString(),
      caching: { type: 'event', key: 'evid', multiple: true }
    }),
    resolve: (obj, args, req) => {
      canGetEvents(req, args);

      const filter = {};
      if (!args.all) {
        filter.enabled = true;
      }
      if (req.user.type === 'r') {
        filter.entities = {
          $in: req.user.enid,
        }
      }

      return Event.find(filter);
    },
  },
});

schemaComposer.Mutation.addNestedFields({
  'event.create': {
    type: 'Event',
    args: {
      enabled: 'Boolean',
      name: 'String!',
      description: 'String',
      start: 'Date',
      location: 'String',
      studentSubmitDeadline: 'Date',
      entities: '[ID!]'
    },
    description: JSON.stringify({
      caching: { type: 'event', key: 'evid', create: true }
    }),
    resolve: async (obj, args, req) => {
      if (req.user.type !== 'a') {
        throw new Error('UNAUTHORIZED create a new event');
      }

      if (args.entities) {
        await checkEntitiesExist(args.entities);
      }

      return Event.create(args);
    },
  },
  'event.update': {
    type: 'Event',
    args: {
      evid: 'ID!',
      enabled: 'Boolean',
      name: 'String',
      description: 'String',
      start: 'Date',
      location: 'String',
      studentSubmitDeadline: 'Date',
      entities: '[ID!]'
    },
    description: JSON.stringify({
      caching: { type: 'event', key: 'evid', update: true }
    }),
    resolve: async (obj, args, req) => {
      if (req.user.type !== 'a') {
        throw new Error('UNAUTHORIZED update an event');
      }

      if (args.entities) {
        await checkEntitiesExist(args.entities);
      }

      const evid = args.evid;
      delete args.evid;
      return Event.findByIdAndUpdate(evid, { $set: args }, { new: true });
    },
  },
  'event.delete': {
    type: 'Event',
    args: {
      evid: 'ID!',
    },
    description: JSON.stringify({
      caching: { type: 'event', key: 'evid', delete: true }
    }),
    resolve: (obj, args, req) => {
      if (req.user.type !== 'a') {
        throw new Error('UNAUTHORIZED create delete an event');
      }

      return Event.findByIdAndDelete(args.evid);
    },
  },

  'event.entity.add': {
    type: 'Event',
    args: {
      evid: 'ID!',
      enid: 'ID!',
    },
    description: JSON.stringify({
      caching: { type: 'event', key: 'evid', update: true }
    }),
    resolve: async (obj, args, req) => {
      if (req.user.type !== 'a') {
        throw new Error('UNAUTHORIZED add an entity to an event');
      }

      const res = await rgraphql('api-entity', 'query($enid:ID!) { entity(enid:$enid) { enid } } ', { enid: args.enid });
      if (res.errors) {
        console.error('Checking entity failed:', res.errors);
        throw new Error('Unexpected error while checking if entity exists');
      }
      if (!res.data.entity) {
        throw new Error('Could not find an entity with that enid');
      }

      return Event.findByIdAndUpdate(args.evid, { $push: { entities: args.enid } }, { new: true });
    },
  },
  'event.entity.del': {
    type: 'Event',
    args: {
      evid: 'ID!',
      enid: 'ID!',
    },
    description: JSON.stringify({
      caching: { type: 'event', key: 'evid', update: true }
    }),
    resolve: (obj, args, req) => {
      if (req.user.type !== 'a') {
        throw new Error('UNAUTHORIZED delete an entity from an event');
      }

      return Event.findByIdAndUpdate(args.evid, { $pull: { entities: args.enid } }, { new: true });
    },
  },
})

const schema = schemaComposer.buildSchema();

const executeGraphql = ({ query, variables = {}, context = {} }) => graphql({ schema, source: query, variableValues: variables, contextValue: context });
export default executeGraphql;
