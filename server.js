// 一、创建静态文件服务器
//创建静态文件服务器既要用到Node内置的功能，
//也要用第三方的mime附加模块来确定文件
//的的MIME类型。

var http = require('http'); //http服务器和客户端
var fs = require('fs');
var path = require ('path');  //内置的path模块提供了与文件系统路径相关的
var mime = require('mime');   //附加的mime模块有根据文件扩展名,得出MIME类型的能力
var cache = {} //cache是用来缓存文件内容的对象

//1、发送文件数据及错误响应
function send404(response) {
   response.writeHead(404, {'Content-Type':'text/plain'});
   response.write('Error404, response not found');
   response.end();
}
// 2、提供文件数据服务
function sendFile(response, filePath, fileContents) {
  //先写出正确的HTTP头
  //然后发送文件的内容
  response.writeHead(200,
    {'content-type':mime.lookup(path.basename(filePath))}
    );
  response.end(fileContents);
}
//访问内存（RAM）要比访问文件系统快得多，所以Node程序通常会把常用的数据缓存到内存里。
// 3、提供静态文件服务
function serveStatic (response, cache, absPath) {
 if (cache[absPath]) { //检查文件是否缓存在内存中
   sendFile(response, absPath, cache[absPath]) //从内存中返回文件
 } else {
   fs.exists(absPath, function(exists){
     if (exists) {
       fs.readFile(absPath, function(err, data){
         if (err) {
           send404(response);
         } else {
           cache[absPath] = data;
           sendFile(response, absPath, data); //从硬盘中读取文件并返回
         }
       });
     } else {
       send404(response); // 发送HTTP 404响应
     }
   })
 }
}
// 二、创建HTTP服务器
// 1、创建
var server = http.createServer(function(request, response) {
  var filePath = false;
  if (request.url == '/') {
    filePath = 'public/index.html';
  } else {
    filePath = 'public' + request.url;
  }
  var absPath ='./' + filePath;
  serveStatic(response, cache, absPath)
})
// 2 启动HTTP服务器
server.listen(3001, function () {
  console.log("Server listening on port 3001.")
})

// 三、设置Socket.IO服务器
var chatServer = require('./lib/chat_server')
chatServer.listen(server)