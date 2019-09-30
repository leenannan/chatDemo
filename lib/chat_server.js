//这些声明让我们可以使用Socket.IO，
//并初始化了一些定义聊天状态的变量：
var socketio = require('socket.io'); //继承EventEmitter
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {}
// 1、确立连接逻辑
// 定义聊天服务器函数listen。
// server.js中会调用这个函数
// 启动Socket.IO服务器，允许它搭载在已有的HTTP 服 务器上
exports.listen = function (server) {
  //传入server实例化io
  //server.listen（httpServer ,[options]） 等同于 require('socket.io')(httpServer, {})
  //httpServer要绑定的服务器。
  //io = require('socket.io').listen(server);将 socket.io 绑定到服务器上，
  //于是任何连接到该服务器的客户端都具备了实时通信功能。
  io = socketio.listen(server);
  //server.serveClient（[value]）serveClient
  //如果value是true连接的服务器（请参阅Server#attach）将担任客户端文件
  // io.serveClient('log level', 1);
  // io.set('log level', 1);
  //在客户端连接时被触发。
  //io.sockets.on('connection', function (socket) { ... })的作用是
  //服务器监听所有客户端，并返回该新连接对象，
  //接下来我们就可以通过该连接对象（socket）与客户端进行通信了。
  io.sockets.on('connection',function (socket) {
    //在用户连接上来时赋予其一个访客名
    guestNumber = assignGuestName (socket, guestNumber, nickNames, namesUsed);
    //在用户连接上来时把他放入聊天室Lobby里
    joinRoom(socket, 'Lobby');
    //处理用户的消息，更名，以及聊天室的创建和变更
    handleMessageBroadCasting(socket, nickNames)
    handleNameChangeAttempts(socket, nickNames, namesUsed)
    handleRoomJoining(socket);
    //用户发出请求时，向其提供已经被占用的聊天室的列表
    socket.on('room', function(){
      socket.emit('rooms', io.sockets.manager.rooms);
    });
    // 定义用户断开连接后的清除逻辑
    handleClientDisconnection(socket, nickNames, namesUsed);
  })
}
// 2、处理程序场景及事件
//分配昵称；房间更换请求；昵称更换请求; 发送聊天消息；房间创建；用户断开连接。
// (1)分配昵称；
function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
  //生成新昵称
  var name = 'Guest' + guestNumber;
  //socket.id 会话的唯一标识符，来自底层Client。
  nickNames[socket.id] = name;
  //让用户知道他们的昵称
  //使用emit向服务器提交事件
  socket.emit('nameResult',{success: true, name: name});
  //存放已经被占用的昵称
  namesUsed.push(name);
  //增加用来生成昵称的计数器
  return guestNumber + 1;
}
//进入聊天室
// (2)加入聊天室
function joinRoom (socket, room) {
  //让用户进入房间
  //记录用户的当前房间
  //socket.join（room [，callback]）
  //将客户端添加到room，并且可选地启动带有err签名的回调（如果有）
  socket.join(room);
  currentRoom[socket.id] = room;
  //让用户知道他们进入了新的房间
  //让房间里的其他用户知道有新用户进入了房间
  socket.emit('joinResult', {room: room});
  //使用broadcast广播
  socket.broadcast.to(room).emit('message', {
    text: nickNames[socket.id] + 'has joined' + room +'.'
  })
  // 版本问题.
  // io.sockets.manager.rooms (获取所有房间（分组）信息)
  // 用 io.sockets.adapter.rooms 代替
  // io.sockets.clients('particular room')(获取particular room中的客户端，
  // 返回所有在此房间的socket实例)
  // 换成了 io.sockets.adapter.rooms['private_room'];
  var usersInRoom = io.sockets.clients(room); //this will return an array of the sockets in the room. So to get the amount of people in the room, be sure to append .length to the above code 
  //如果不止一个用户在这个房间里，汇总下都是谁
  if (usersInRoom.length > 1) {
    var usersInRoomSummary = 'Users currently in' + room + ': ';
    for (var index in usersInRoom) {
      var userSocketID = usersInRoom[index].id;
      if (userSocketID != socket.id) {
        if (index > 0) {
          usersInRoomSummary += ',';
        }
        usersInRoomSummary += nickNames[userSocketID];
      }
    }
    usersInRoomSummary +='.';
    //将房间里其他用户的汇总发送给这个用户
    socket.emit('message', {text: usersInRoomSummary});
  }
}
// (3)处理昵称变更请求
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
  //添 加 nameAttempt事件的监听器
  socket.on('nameAttempt', function (name) {
    //昵称不能以Guest开头
    if(name.indexOf('Guest') == 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin width "Guest"'
      });
    } else {
      // 如果昵称可以使用
      if (namesUsed.indexOf(name) == -1) {
        //删掉之前用的昵称，让其他用户可以使用
        var previousName = nickNames[socket.id];
        var previousNameIndex = namesUsed.indexOf(previousName);
        namesUsed.push(name);
        nickNames[socket.id] = name;
        delete namesUsed[previousNameIndex];
        socket.emit('nameResult', {success:true,name:name})
        // 对分组中的用户发送信息
        // 不包括自己
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: previousName + 'is now known as' + name + '.'
        })
      } else {
        // 如果昵称已经被占用，给客户端发送错误消息
        socket.emit('nameResult', {
          success:false,
          message: 'That name is already in  use'
        })
      }
    }
  })
}
// （4）发送聊天消息
function handleMessageBroadCasting (socket) {
  // 收到对方发来的数据后触发 message 事件（通常为 socket.send() 触发）
  socket.on('message', function (message) {
    // 对分组中的用户发送信息
    // 不包括自己
    console.log(nickNames[socket.id] + ':' + message.text)
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ':' + message.text
    })
  })
}

// (5)创建房间
// 接下来要添加让用户加入已有房间的逻辑，如果房间还没有的话，则创建一个房间
function handleRoomJoining (socket) {
  socket.on('join', function(room) {
    // 踢出分组
    socket.leave(currentRoom[socket.id]);
    joinRoom(socket, room.newRoom);
  })
}
// (6)用户断开连接
// 当用户离开聊天程序时，从 nickNames和namesUsed中移除用户的昵称
function handleClientDisconnection (socket) {
  // 当对方关闭连接后触发 disconnect 事件
  socket.on('disconnect', function () {
    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  })
}