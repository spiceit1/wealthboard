import assert from 'node:assert/strict';
import { getPlaidRedirectUri } from '../lib/plaid-redirect';
assert.equal(getPlaidRedirectUri({URL:'https://wealth.example',APP_URL:'http://localhost:3000'}),'https://wealth.example/connections');
assert.equal(getPlaidRedirectUri({APP_URL:'https://wealth.example/old?test=1'}),'https://wealth.example/connections');
assert.equal(getPlaidRedirectUri({URL:'invalid',APP_URL:'https://wealth.example'}),'https://wealth.example/connections');
for (const APP_URL of ['http://localhost:3000','http://wealth.example','https://user:password@wealth.example','invalid','']) {
  assert.throws(()=>getPlaidRedirectUri({APP_URL}),/HTTPS site URL/);
}
console.log('Plaid redirect checks passed');
