import { expect } from 'chai';

import { fail } from './lib.js';
import api from './api.js';
import initDB, { init, disconnect, db, models } from './db.js';

const entity_import = {
  csv: `Name,Column1,Last login,Fairs paid,Contact e-mail addresses,Votes,Representatives,ID
Entity 1,Elodie Snel,01/01/2022,,elodie@snel.nl;,0,0,84336
Entity 2,Christian de lange,01/12/2021,,christian@lange.nl;,0,0,84202
University of Amsterdam: Graduate School of Informatics (Senior TAs),"dr. ing. Cristian Hugo Echbert, dr. Jochem Emo Sloom",,,c.h.echbert@uva.nl;j.esloom@uva.nl;,0,0,80854
`,
  data: [
    { name: 'Entity 1', external_id: 84336 },
    { name: 'Entity 2', external_id: 84202 },
    { name: 'University of Amsterdam: Graduate School of Informatics (Senior TAs)', external_id: 80854 }
  ]
};

const testQuery = () => {
  it('query entity should get an entity', async () => {
    const res = await api.entity.get(db.entities[0].enid).exec();
    expect(res).to.deep.equal(db.entities[0]);
  });

  it('query entities should get the correct entities', async () => {
    const res = await api.entity.getMultiple([db.entities[1].enid, db.entities[0].enid]).exec();
    expect(res).to.deep.include(db.entities[0]);
    expect(res).to.deep.include(db.entities[1]);
  });
}

const permissions = {
  getAll: () => {
    it('mutation getAll should hanle permissions properly', async () => {
      await fail(api.entity.getAll().exec);
    });
  },
  create: () => {
    it('mutation create should hanle permissions properly', async () => {
      const newEntity = { ...db.entities[0] };
      delete newEntity.enid;

      await fail(api.entity.create(newEntity).exec);
    });
  },
  update: () => {
    it('mutation update should hanle permissions properly', async () => {
      const updatedEntity = { ...db.entities[1], enid: db.entities[0].enid };

      await fail(api.entity.update(updatedEntity).exec);
    });
  },
  delete: () => {
    it('mutation delete should hanle permissions properly', async () => {
      await fail(api.entity.delete(db.entities[0].enid).exec);
    });
  },
  import: () => {
    it('mutation import should hanle permissions properly', async () => {
      await fail(api.entity.import(entity_import.csv).exec);
    });
  },
}

describe('Entity', () => {
  before(init);
  after(disconnect);
  beforeEach(initDB);

  describe('Admin', () => {
    beforeEach(async () => {
      await api.user.login('admin', 'admin');
    });

    testQuery();

    it('query entitiesAll should get all entities' , async () => {
      const res = await api.entity.getAll().exec();
      expect(res).to.deep.equal(db.entities);
    });

    it('mutation entity.create should create an entity', async () => {
      const entity = {
        name: 'New name',
        description: 'New description',
        type: 'company',
        contact: [{ type: 'website', content: 'qrcsoftware.nl' }, { type: 'phonenumber', content: '06 12345678' }],
        external_id: 100,
      }

      const res = await api.entity.create(entity).exec();

      expect(res.enid).to.exist;
      expect(res).to.deep.equal({ ...entity, enid: res.enid });
    });

    it('should check enum values properly', async () => {
      const check = async (entity) => {
        await fail(api.entity.create(entity).exec);
      };

      let entity = JSON.parse(JSON.stringify(db.entities[0]));
      delete entity.enid;
      entity.type = 'invalidType';
      await check(entity);

      entity = JSON.parse(JSON.stringify(db.entities[0]));
      delete entity.enid;
      entity.contact[0].type = 'invalidType';
      await check(entity);
    });

    it('mutation entity.update should update the entity', async () => {
      const updatedEntity = { ...db.entities[1], enid: db.entities[0].enid };
      const res = await api.entity.update(updatedEntity).exec();
      expect(res).to.deep.equal(updatedEntity);
    });

    it('mutation entity.delete should delete the entity, linked projects and representatives', async () => {
      const res = await api.entity.delete(db.entities[0].enid).exec();
      expect(res).to.deep.equal(db.entities[0]);

      const query = await api.entity.get(db.entities[0].enid).exec();
      expect(query).to.be.null;

      const representatives = await models.Representative.find({ enid: db.entities[0].enid });
      expect(representatives).to.have.length(0);

      const projects = await models.Project.find({ enid: db.entities[0].enid });
      expect(projects).to.have.length(0);
    });

    it('mutation entity.import should import entities', async () => {
      const res = await api.entity.import(entity_import.csv).exec();

      expect(res.map((e) => e.name)).to.deep.equal(entity_import.data.map((e) => e.name));
      expect(res.map((e) => e.external_id)).to.deep.equal(entity_import.data.map((e) => e.external_id));

      // TODO: Test if users were made properly
    });

    it('mutation entity.import should not double import entities', async () => {
      await api.entity.import(entity_import.csv).exec();
      const res = await api.entity.import(entity_import.csv).exec();

      expect(res.every((v) => v === null), 'All returned entities are null').to.be.true;

      // TODO: Test if users were not made
    });
  });

  describe('Admin representative', () => {
    beforeEach(async () => {
      await api.user.login('repAdmin', 'repAdmin');
    });

    testQuery();

    permissions.getAll();
    permissions.create();

    it('mutation entity.update should update the entity', async () => {
      const updatedEntity = { ...db.entities[1], enid: db.entities[0].enid, type: db.entities[0].type };
      const updateQuery = {...updatedEntity};
      delete updateQuery.type;
      const res = await api.entity.update(updateQuery).exec();
      expect(res).to.deep.equal(updatedEntity);
    });

    it('mutation entity.update should not allow admin representatives to update entity type', async () => {
      await fail(api.entity.update({ enid: db.entities[0].enid, type: 'research' }).exec);
    })

    permissions.delete();
    permissions.import();
  });

  describe('Representative', () => {
    beforeEach(async () => {
      await api.user.login('rep', 'rep');
    });

    testQuery();

    permissions.create();
    permissions.update();
    permissions.delete();
    permissions.import();
  });

  describe('Student', () => {
    beforeEach(async () => {
      await api.user.login('student', 'student');
    });

    testQuery();

    permissions.getAll();
    permissions.create();
    permissions.update();
    permissions.delete();
    permissions.import();
  });
});
