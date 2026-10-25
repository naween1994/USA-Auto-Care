import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User.js';
import { requireAdminPassword } from '../src/middleware/auth.js';
import '../src/routes/authRoutes.js';
import '../src/routes/customerRoutes.js';
import '../src/routes/settingsAuditRoutes.js';

test('administrator password confirmation protects sensitive actions', async () => {
  const originalFindById = User.findById;
  const passwordHash = await bcrypt.hash('Correct-Admin-Password', 4);
  let user = { role: 'admin', isActive: true, passwordHash };
  User.findById = () => ({ select: async () => user });

  async function invoke(password) {
    const response = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };
    let nextCalled = false;
    await requireAdminPassword(
      { user: { _id: 'admin-id' }, body: password === undefined ? {} : { password } },
      response,
      () => {
        nextCalled = true;
      }
    );
    return { response, nextCalled };
  }

  try {
    const accepted = await invoke('Correct-Admin-Password');
    assert.equal(accepted.nextCalled, true);

    const rejected = await invoke('wrong-password');
    assert.equal(rejected.nextCalled, false);
    assert.equal(rejected.response.statusCode, 403);

    const missing = await invoke(undefined);
    assert.equal(missing.nextCalled, false);
    assert.equal(missing.response.statusCode, 400);

    user = { ...user, role: 'receptionist' };
    const nonAdmin = await invoke('Correct-Admin-Password');
    assert.equal(nonAdmin.nextCalled, false);
    assert.equal(nonAdmin.response.statusCode, 403);
  } finally {
    User.findById = originalFindById;
  }
});
