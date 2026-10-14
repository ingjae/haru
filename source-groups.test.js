import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedGroups,eventSource,taskSource,findLinkedTask,taskCompleted} from './public/source-groups.js';
test('group choices preserve an intentionally empty selection and discard inaccessible IDs',()=>{const list=[{id:'a'},{id:'b'}];assert.deepEqual(selectedGroups([],list,'a'),[]);assert.deepEqual(selectedGroups(['b','b','gone'],list,'a'),['b']);assert.deepEqual(selectedGroups(undefined,list,'a'),['a']);});
test('same task ID in two lists retains its original group for linking and edits',()=>{const tasks=[{id:'same',haruTaskListId:'a',status:'completed'},{id:'same',haruTaskListId:'b',status:'needsAction'}];const task=findLinkedTask(tasks,{haruTaskList:'b',haruTaskId:'same'});assert.equal(taskSource(task,'a'),'b');assert.equal(taskCompleted(task),false);assert.equal(taskCompleted(tasks[0]),true);assert.equal(eventSource({haruCalendarId:'b'},'a'),'b');});
