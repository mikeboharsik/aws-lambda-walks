const { getAllVideoItems, getCustomArguments } = require('./common.js');

const items = getAllVideoItems();

const customArgs = getCustomArguments({ accessToken: null, commit: false });