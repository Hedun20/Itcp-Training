const databaseName = process.env.MONGO_APP_DATABASE;
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!databaseName || !username || !password) {
  throw new Error('MONGO_APP_DATABASE, MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required');
}

const applicationDatabase = db.getSiblingDB(databaseName);
const existingUser = applicationDatabase.getUser(username);

if (!existingUser) {
  applicationDatabase.createUser({
    user: username,
    pwd: password,
    roles: [{ role: 'readWrite', db: databaseName }],
  });
  print(`Created MongoDB application user ${username} for ${databaseName}`);
} else {
  print(`MongoDB application user ${username} already exists for ${databaseName}`);
}
