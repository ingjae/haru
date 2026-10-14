const test=require('node:test'),assert=require('node:assert/strict');
const {menuBarWidth}=require('../desktop/menubar-layout.cjs');
test('maximum width uses the current menu-item right edge without growing each refresh',()=>{
 const d={bounds:{x:0,width:3440},internal:false};
 const w=menuBarWidth(0,d,{x:2331,width:196});assert.equal(w,1820);
 assert.equal(menuBarWidth(0,d,{x:691,width:1836}),w);
});
test('internal displays reserve notch space; requested widths are clamped',()=>{
 const d={bounds:{x:0,width:1728},internal:true};
 assert.equal(menuBarWidth(0,d,{x:1304,width:196}),480);
 assert.equal(menuBarWidth(1200,d,{x:1304,width:196}),480);
 assert.equal(menuBarWidth(180,d,{x:1304,width:196}),180);
});
test('negative-origin monitors and missing menu bounds produce bounded widths',()=>{
 const d={bounds:{x:-3440,width:3440},internal:false};
 assert.equal(menuBarWidth(0,d,{x:-1109,width:196}),1820);
 assert.ok(menuBarWidth(0,d,null)>=120);
 assert.throws(()=>menuBarWidth(999,d,null));
});
