

var monoport = '/dev/ttyACM1';
var minitrollport = '/dev/ttyACM0';

var ArduinoFirmata = require('arduino-firmata')
var async = require('async');
var midi = require('midi');
var osc = require('node-osc');

var GATE = 3;

function Monotron(callback){
	var that = this;
   	console.log('Starting monotron');
    var board = new ArduinoFirmata();
    board.connect(monoport);
    board.on('connect',function(){
	board.pinMode(3,ArduinoFirmata.PWM);
	board.pinMode(5,ArduinoFirmata.PWM);
	board.pinMode(7,ArduinoFirmata.OUTPUT);

	board.analogWrite(5,0,function(){});
	board.analogWrite(3,0,function(){});
	console.log('monotron ready');  
	that.board = board;
	callback(null,that);
	});
}

Monotron.prototype.setPitch = function(value) {
	var pitch = (value-37)/12*0.179*255;
	if(pitch> 127)
		pitch = 127;
	if(pitch<0)
		pitch = 0;
	//console.log('Setting pitch to ',pitch);
	this.board.analogWrite(3,Math.round(pitch),function(){});
};

Monotron.prototype.setGate = function(value) {
	this.board.digitalWrite(7,value,function(){});
};

function Minitroll(callback){
	var that = this;
	console.log('Starting minitroll');
	var board = new ArduinoFirmata();
    board.connect(minitrollport);
    board.on('connect',function(){

	board.pinMode(2,ArduinoFirmata.OUTPUT);
	board.pinMode(3,ArduinoFirmata.OUTPUT);
	board.pinMode(4,ArduinoFirmata.OUTPUT);
	board.pinMode(5,ArduinoFirmata.OUTPUT);

	board.pinMode(6,ArduinoFirmata.INPUT);
	board.pinMode(7,ArduinoFirmata.INPUT);
 	console.log('minitroll ready');

 	board.digitalWrite(2,1,function(){});
	callback(null,that);
	});
	this.board = board;
	}

Minitroll.prototype.readKnob = function(value,callback) {
	//console.log('Reading a knob',value+14);
	if(value<0 || value>3) return -1;
	return this.board.analogRead(value);
};

var monotron = function(callback){
   	var monotron = new Monotron(callback);
}; 

var minitroll = function(callback){ 
	var minitroll = new Minitroll(callback);
};


Meeblip = function(){
	this.output = new midi.output();

    var device = 'Uno';
    /* Search the output port */
    var ports = this.output.getPortCount();
   	for (var i = 0; i < ports; i++) {
    name = this.output.getPortName(i);
    if(name.indexOf(device)>-1){
      this.output.openPort(i);
      console.log('Opening output '+name);
      break;
    	}
   	}	
   	this.output.sendMessage([0xB0,74,127]);
};

Meeblip.prototype.noteOn = function(pitch) {
	this.output.sendMessage([0x90,pitch,127]);
};

Meeblip.prototype.noteOff = function(pitch) {
	this.output.sendMessage([0x80,pitch,0]);
};

Meeblip.prototype.setResonance = function(value) {
	this.output.sendMessage([0xB0,48,Math.round(value)]);
};

Meeblip.prototype.setCutoff = function(value) {
	console.log('Cuttof ',value);
	this.output.sendMessage([0xB0,49,Math.round(value)]);
};

Meeblip.prototype.setWaveA = function(value) {
	console.log('Wave A ',value);
	this.output.sendMessage([0xB0,79,Math.round(value)]);
};

Meeblip.prototype.setPWM = function(value) {
	console.log('Wave PWM ',value);
	this.output.sendMessage([0xB0,54,Math.round(value)]);
};

Meeblip.prototype.setDecay = function(value) {
	console.log('Decay ',value);
	this.output.sendMessage([0xB0,60,Math.round(value)]);
};

Meeblip.prototype.setAttack = function(value) {
	console.log('Attack ',value);
	this.output.sendMessage([0xB0,59,Math.round(value)]);
};

Blend = function(){

};

Blend.prototype.open = function(callback){
	var that = this;
	async.parallel([monotron,minitroll],
	function(err, results){
	    that.monotron = results[0];
	    that.minitroll = results[1];
	    that.meeblip = new Meeblip();

	    console.log('All devices are ready');

	    callback(that);
	});

};

Blend.prototype.noteOn = function(pitch) {
	this.monotron.setPitch(pitch);
	this.monotron.setGate(1);
	this.meeblip.noteOn(pitch);
};

Blend.prototype.noteOff = function(pitch) {
	this.monotron.setGate(0);
	this.meeblip.noteOff(pitch);
};


var blend = new Blend();

blend.open(function(blend_ready){
	console.log('Blend ready');

	blend_ready.meeblip.setResonance(0);
	blend_ready.meeblip.setCutoff(127);


 	var count = 0;
 	var pitch = 32;

 	setInterval(function(){
 		var cutoff = blend_ready.minitroll.readKnob(0)/6;
 		blend_ready.meeblip.setCutoff(cutoff);

 		var PWM = blend_ready.minitroll.readKnob(1)/6;
 		blend_ready.meeblip.setPWM(PWM);

 		var attack = blend_ready.minitroll.readKnob(2)/6;
 		blend_ready.meeblip.setAttack(attack);

 		var decay = blend_ready.minitroll.readKnob(3)/6;
 		blend_ready.meeblip.setDecay(decay);
 	},500);

 	for(var p=0;p<128;p++){
 		blend_ready.noteOff(p);
 	}

 	var oscServer = new osc.Server(3333, '0.0.0.0'); 
	oscServer.on("message", function (msg, rinfo) { 
		if(msg[0]=='/note'){
			if(msg[2]===0){
				blend_ready.noteOff(msg[1]);
			}
			else
			{
				blend_ready.noteOn(msg[1])
			}
		console.log("TUIO message:"); console.log(msg); 
		}
	});

});