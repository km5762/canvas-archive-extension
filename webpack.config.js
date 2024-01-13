const path = require('path');

module.exports = {
    entry: './src/service-worker.js', // Adjust the entry point based on your project structure
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
};