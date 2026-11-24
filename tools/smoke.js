const J = require('./load.js')();
const pr = J.newProject({ title: '测试' });
console.log(Object.keys(J).filter((k) => typeof J[k] === 'function').join(','));
console.log(J.paletteOf(pr));
console.log(J.speakingSeconds('大家好，我是讲解成片。', 1).toFixed(2));