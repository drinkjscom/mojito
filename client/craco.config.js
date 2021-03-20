const path = require('path');
const webpack = require('webpack');
const CracoLessPlugin = require('craco-less');

console.log(process.env.REACT_APP_REACT_CDN);

module.exports = {
  devServer: (devServerConfig, { env, paths, proxy, allowedHost }) => {
    return {
      ...devServerConfig,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3838',
          changeOrigin: true,
          pathRewrite: { '^/api': '' }
        },
        '/public': {
          target: 'http://127.0.0.1:3838',
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://127.0.0.1:3838',
          ws: true,
          changeOrigin: true
        }
      }
    };
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              '@ant-prefix': 'mojito'
              // '@iconfont-css-prefix': 'mojitoicon'
            },
            javascriptEnabled: true
          }
        }
      }
    }
  ],
  webpack: {
    alias: {},
    plugins: {
      add: [
        new webpack.DefinePlugin({
          REACT_APP_LIB_URI: JSON.stringify(process.env.REACT_APP_LIB_URI)
        }),
        new webpack.ProgressPlugin()
      ],
      remove: [] /* An array of plugin constructor's names (i.e. "StyleLintPlugin", "ESLintWebpackPlugin" ) */
    },
    configure: (webpackConfig, { env, paths }) => {
      /* Any webpack configuration options: https://webpack.js.org/configuration */
      webpackConfig.module.rules.push({
        test: /(.routes.js)/,
        use: {
          loader: path.resolve(__dirname, './router-loader.js')
        }
      });
      return {
        ...webpackConfig,
        externals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          antd: 'antd'
        }
      };
    }
  }
};
