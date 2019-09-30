// 添加跟服务器通信所需要的客户端JavaScript了。客户端JavaScript需要实现以下功能：
//  向服务器发送用户的消息和昵称/房间变更请求；
//  显示其他用户的消息，以及可用房间的列表。
// 一、定义javaScript类 在初始化时可用传入一个Socket.IO的参数socket
var Chat = function(socket) {
  this.socket = socket;
}
// 发送聊天消息的函数
Chat.prototype.sendMessage = function (room, text) {
  var message = {
    room: room,
    text: text
  };
  console.log(room, text, 'sendMessage')
  this.socket.emit('message', message);
}
// 变更房间的函数：
Chat.prototype.changeRoom = function (room) {
  this.socket.emit('join', {
    newRoom: room
  })
}
// 处理聊天命令。它能识别两个命令：join用来加入或创建一个房间，nick用来修改昵称。
Chat.prototype.processCommand = function(command) {
  var words = command.split(' ');
  // 从第一个单词开始解析命令
  var command = words[0].substring(1, words[0].length).toLowerCase();
  var message = false;
  switch (command) {
    case 'join':
      words.shift();
      var room = words.join(' '); //处理房间的变换/创建
      this.changeRoom(room);
      break;
    case 'nick':
      words.shift();
      var name = words.join(' ');
      this.socket.emit('nameAttempt', name); //处理更名尝试
      break;
   default:
      message ='Unrecognized command'; //如果命令无法识别，返回错误消息
      break;
  }
  return message;
}