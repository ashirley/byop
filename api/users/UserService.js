import { argon2, randomBytes } from 'crypto'

export class UserService {
  constructor(dao) {
    this.dao = dao;
  }

  async validatePassword(username, pass) {
    const user = await this.dao.getUser(username);
    if (user == null) {
      console.warn(`Couldn't find user ${username}`);
      return false;
    }

    const [ salt, actualHash ] = user.passwordHash.split(":")
    const hashesMatch = await this.hashPassword(pass, Buffer.from(salt, 'hex')) == actualHash
    if (!hashesMatch) {
      console.warn(`Wrong password for user ${username}`);
    }
    return hashesMatch
  }

  async register(username, pass) {
    //TODO: promClient
    const existingUser = await this.dao.getUser(username);
    if (existingUser != null) {
      console.warn("Tried to register a user that already exists: " + username)
      return false;
    }

    const salt = randomBytes(16);
    const hash = await this.hashPassword(pass, salt)

    await this.dao.storeUser({username: username, passwordHash: `${salt.toString('hex')}:${hash}`})
    return true;
  }

  async hashPassword(pass, salt) {
    // https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
    const parameters = {
      message: pass,
      nonce: salt,
      parallelism: 1,
      tagLength: 64,
      memory: 19456,
      passes: 2,
    };

    return new Promise((resolve, reject) => {
      argon2('argon2id', parameters, (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString('hex'));
      });
    });
  }
}