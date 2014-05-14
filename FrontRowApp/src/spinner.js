// JavaScript Document
document.write("HELLO WORLD");

function Spinner(tag){
	this.el = tag;
}

Spinner.prototype.spin(target) = function(target){
	var s = document.createElement(this.el);
	// stick it on the page
	target.insertBefore(s, target.firstChild || null);
	// set attributes?
};

Spinner.prototype.stop = function(){
	$(this.el).fadeOut(1000);
	var e = this.el;
	if(el.parentNode){
		el.parentNode.removeChild(el);
	}
	
};

var target = document.getElementById('div body');
var spinner = new Spinner(target);

var oReq = new XMLHttpRequest();
var url = "";

oReq.open("GET", url, true);
oReq.onreadystatechange = onStateChange;

function onStateChange(){
	if(oReq.readyState == 1){
		spinner.spin();
	}
	if(oReq.readyState == 4){
		spinner.stop();
		if(oReq.status == 200){
			respone = oReq.responseText;
		}
	}
}