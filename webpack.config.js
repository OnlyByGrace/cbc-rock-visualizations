var webpack = require('webpack');

var config = {
    mode: 'production',
    entry: './src/index.ts',
    resolve: {
      extensions: ['.ts','.js']
    },
    module: {
        rules: [
            {
              test: /\.ts/,
              exclude: /node_modules/,
              use: {
                loader: "ts-loader"
              }
            }
          ]
      
    },
}

module.exports = config;