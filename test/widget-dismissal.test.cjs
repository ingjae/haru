const test=require('node:test');const assert=require('node:assert/strict');
const {parseMouseDown,shouldDismiss}=require('../desktop/widget-dismissal.cjs');
const state={expanded:true,editing:false};
test('outside clicks dismiss an unfocused expanded panel, inside clicks do not',()=>{
 const b={x:1300,y:30,width:420,height:1000};
 assert.equal(shouldDismiss({x:1200,y:100},b,state),true);
 assert.equal(shouldDismiss({x:1350,y:100},b,state),false);
 assert.equal(shouldDismiss({x:1720,y:100},b,state),true);
});
test('click coordinates work on displays above and left of the primary screen',()=>{
 const b={x:-1440,y:-900,width:420,height:800};
 assert.equal(shouldDismiss({x:-1300,y:-500},b,state),false);
 assert.equal(shouldDismiss({x:0,y:0},b,state),true);
});
test('editors are preserved, collapsed panels ignore clicks, malformed events are ignored',()=>{
 const b={x:0,y:0,width:420,height:800};
 assert.equal(shouldDismiss({x:900,y:100},b,{expanded:true,editing:true}),false);
 assert.equal(shouldDismiss({x:900,y:100},b,{expanded:false,editing:false}),false);
 assert.equal(parseMouseDown('mouse-down NaN 10'),null);
 assert.equal(parseMouseDown('mouse-down 10 20 extra'),null);
 assert.equal(parseMouseDown('trusted'),null);
 assert.deepEqual(parseMouseDown('mouse-down -1300.5 -500'),{x:-1300.5,y:-500});
});

test('the opening click is not interpreted as an outside dismissal',()=>{
 const b={x:0,y:0,width:420,height:800},point={x:900,y:100};
 assert.equal(shouldDismiss(point,b,{...state,openedAt:1000,now:1100}),false);
 assert.equal(shouldDismiss(point,b,{...state,openedAt:1000,now:1300}),true);
});
test('menu bar panels are anchored below the menu bar and clamped to their display',()=>{
 const {menuBarPanelBounds}=require('../desktop/widget-dismissal.cjs');
 assert.deepEqual(menuBarPanelBounds({x:2477,y:0,width:196,height:30},{x:0,y:30,width:3440,height:1410}),{x:2365,y:30,width:420,height:800});
 const b=menuBarPanelBounds({x:-10,width:120},{x:-1440,y:40,width:1440,height:760});
 assert.equal(b.x,-420);assert.equal(b.y,40);assert.equal(b.height,760);
});
