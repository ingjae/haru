const test=require('node:test');const assert=require('node:assert/strict');
const {desktopCredential,authError}=require('../desktop/google-auth.cjs');
test('rejects web clients and calendar exports with actionable messages',()=>{
  assert.throws(()=>desktopCredential({web:{client_id:'example'}}),/웹 애플리케이션/);
  assert.throws(()=>desktopCredential({items:[]}),/내보내기/);
  assert.throws(()=>desktopCredential({installed:{client_id:123,client_secret:'example'}}),/데스크톱/);
});
test('copies only desktop OAuth fields',()=>assert.deepEqual(desktopCredential({installed:{client_id:'example',client_secret:'example',extra:'discard'}}),{client_id:'example',client_secret:'example'}));
test('errors explain recovery without returning arbitrary provider data',()=>{
  assert.match(authError('invalid_grant'),/다시 로그인/);
  assert.match(authError('access_denied'),/테스트 사용자/);
  assert.ok(!authError('sensitive-example').includes('sensitive-example'));
});
