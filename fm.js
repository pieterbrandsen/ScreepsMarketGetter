import forever from 'forever-monitor';

const child = new forever.Monitor('index.js');

child.start(); 