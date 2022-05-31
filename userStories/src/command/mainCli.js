import child_process from 'child_process';
import { Command } from 'commander';
import mongoose from 'mongoose';

import dbProvisioner from './initDB.js';

const Result = mongoose.model('Result', new mongoose.Schema({
  run: String,
  time: Date,
  proc: String,
  event: String,
  data: Object
}));


const init = async (events, admins, students, studentVotes, entities, adminRepresentatives, representatives, projects) => {
  console.log('Initializing database...');
  const provisionar = dbProvisioner({
    events,
    admins,
    students,
    studentVotes,

    entities,
    adminRepresentatives,
    representatives,
    projects,
  });

  await provisionar.init();
  await provisionar.provision();
  await provisionar.disconnect();

  console.log('DB initialization done');
  console.log('\nTo test with all users execute the following command:');
  console.log(`node mainCli.js run ${events} ${admins} ${students} ${entities} ${adminRepresentatives} ${representatives}`);
};

const subprocesses = [];
const exec = (type, url, db, run, ...options) => {
  const proc = child_process.spawn('node', [`../subordinate/${type}/index.js`, 'simulate', ...options, '--url', url]);
  proc.stderr.pipe(process.stderr);

  let buffer = '';
  let strings;
  proc.stdout.on('data', (data) => {
    if (!db) {
      console.log(data.toString().strip())
      return;
    }

    buffer += data.toString();
    strings = buffer.split('\n');
    if (strings.length === 0) {
      return;
    }

    buffer += strings.pop()
    for (const string of strings) {
      data = JSON.parse(string);
      data.run = run;
      Result.create(data);
    }
  });

  proc.on('exit', (code) => {
    if (code !== 0) {
      console.error('[!]', type, ...options, 'crashed');
      return;
    }

    console.log(['mainCli', 'procDone', type, ...options].join(','));
  });
  subprocesses.push(proc);
}

const run = async (events, admins, students, entities, adminRepresentatives, representatives, url, servers, serverIndex, options) => {
  const { db, run } = options;
  const dbFlag = !!db;
  if (dbFlag) {
    console.log('Connecting to results database');
    await mongoose.connect(db);
    console.log('Connected to results database');
  }
  console.log('Running...');

  await Result.create({
    run: run,
    time: Date.now(),
    proc: 'mainCli',
    event: 'runStart',
    data: {
      events, admins, students, entities, adminRepresentatives, representatives, url, servers, serverIndex
    }
  });

  process.stderr.setMaxListeners(1000);

  const eventsChunk = events / servers;
  const adminsChunk = admins / servers;
  const studentsChunk = students / servers;
  const entitiesChunk = entities / servers;
  const adminRepresentativesChunk = adminRepresentatives / servers;
  const representativesChunk = representatives / servers;

  for (let event = eventsChunk * serverIndex; event < eventsChunk * (serverIndex + 1); event++) {
    for (let admin = adminsChunk * serverIndex; admin < adminsChunk * (serverIndex + 1); admin++) {

    }

    for (let student = studentsChunk * serverIndex; student < studentsChunk * (serverIndex + 1); student++) {
      exec('student', url, dbFlag, run, event, student);
    }

    for (let entity = entitiesChunk * serverIndex; entity < entitiesChunk * (serverIndex + 1); entity++) {
      for (let adminRepresentative = adminRepresentativesChunk * serverIndex; adminRepresentative < adminRepresentativesChunk * (serverIndex + 1); adminRepresentative++) {
        exec('adminRepresentative', url, dbFlag, run, event, entity, adminRepresentative);
      }

      for (let representative = representativesChunk * serverIndex; representative < representativesChunk * (serverIndex + 1); representative++) {
        exec('representative', url, dbFlag, run, event, entity, representative);
      }
    }
  }
};

const main = () => {
  const program = new Command();
  program.command('init')
    .argument('<events>', 'The amount of events', parseInt)
    .argument('<admins>', 'The amount of admins per event', parseInt)
    .argument('<students>', 'The amount of students per event', parseInt)
    .argument('<studentVotes>', 'The amount of votes for projects per student. Should be smaller or equal to entities * projects', parseInt)
    .argument('<entities>', 'The amount of entities per event', parseInt)
    .argument('<adminRepresentatives>', 'The amount of admin representatives per entity', parseInt)
    .argument('<representatives>', 'The amount of representatives per entity', parseInt)
    .argument('<projects>', 'The amount of projects per entity', parseInt)
    .description('Initialize the database for stress testing')
    .action(init);

  program.command('run')
    .argument('<events>', 'The amount of events', parseInt)
    .argument('<admins>', 'The amount of admins per event', parseInt)
    .argument('<students>', 'The amount of students per event', parseInt)
    .argument('<entities>', 'The amount of entities per event', parseInt)
    .argument('<adminRepresentatives>', 'The amount of admin representatives per entity', parseInt)
    .argument('<representatives>', 'The amount of representatives per entity', parseInt)
    .argument('[url]', 'The url of the webserver to run against', 'http://localhost:3000/')
    .argument('[servers]', 'The amount of servers the workload is split over', (v) => parseInt(v), 1)
    .argument('[serverIndex]', 'The index of this server', (v) => parseInt(v), 0)
    .option('--db [dburi]', 'Dump the results to the mongodb database available at this url', false)
    .option('--run [name]', 'Name this run in the mongodb database', '')
    .action(run);

  program.parse();
}
main();
