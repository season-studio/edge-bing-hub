const webpack = require('webpack');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");

/* global require, module, process, __dirname */

module.exports = async (env, options) => {
    const dev = options.mode === "development";
    const config = {
        devtool: "source-map",
        entry: {
            polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
            vendor: ["react", "react-dom", "core-js"],
            index: ["react-hot-loader/patch", "./src/index.js", "./src/index.html"],
        },
        output: {
            clean: true,
        },
        resolve: {
            extensions: [".ts", ".tsx", ".html", ".js"],
        },
        module: {
            rules: [
                {
                    test: /\.jsx?$/,
                    use: [
                        "react-hot-loader/webpack",
                        {
                            loader: "babel-loader",
                            options: {
                                presets: ["@babel/preset-env"],
                            },
                        },
                    ],
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/preset-env"],
                        },
                    },
                },
                {
                    test: /\.html$/,
                    exclude: /node_modules/,
                    use: "html-loader",
                },
                {
                    test: /\.(png|jpg|jpeg|gif|ico)$/,
                    type: "asset/resource",
                    generator: {
                        filename: "assets/[name][ext][query]",
                    },
                },
            ],
        },
        plugins: [
            new webpack.DefinePlugin({
                PackStamp: `"${Date.now()}"`
            }),
            new HtmlWebpackPlugin({
                filename: "index.html",
                template: "./src/index.html",
                chunks: ["polyfill", "vendor", "index"],
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: "assets/*",
                        to: "assets/[name][ext][query]",
                    }
                ],
            }),
            new webpack.ProvidePlugin({
                Promise: ["es6-promise", "Promise"],
            }),
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, "dist"),
                publicPath: "/public",
            },
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            server: {
                type: "http",
                //options: env.WEBPACK_BUILD || options.https !== undefined ? options.https : await getHttpsOptions(),
            },
            port: process.env.npm_package_config_dev_server_port || 3000,
        },
        performance: {
            hints: false, // 枚举
            maxAssetSize: 30000000, // 整数类型（以字节为单位）
            maxEntrypointSize: 50000000, // 整数类型（以字节为单位）
            assetFilter: function (assetFilename) {
                // 提供资源文件名的断言函数
                return assetFilename.endsWith(".css") || assetFilename.endsWith(".js");
            }
        }
    };

    return config;
};
