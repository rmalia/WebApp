// JavaScript Document

$(function() {
	
	Parse.$ = jQuery;	
	var appID = "";
	var jsKey = "";
	
	// Initialise Parse
	Parse.initialize(appID, jsKey);
	
	// Shopping Item Object
	// should have list of items (preferably with quantities), whether an item was got, ordering on items, etc?
	var ShoppingItem = Parse.Object.extend("ShoppingItem", {
		// Default shopping item attributes
		defaults: {
			content: "no item...", 
			gotten: false, // did we get the item
			quantity: 0, // number to get
			container: ["", "box", "dozen", "6-pack", "oz", "lb"] // identifiers to help with selection?
		},
		
		// initialize with defaults
		initialize: function() {
			if(!this.get("content")){
				this.set({"content": this.defaults.content});
			}
			if(!this.get("quantity")){
				this.set({"quantity": this.defaults.quantity});
			}
			if(!this.get("container")){
				this.set({"quantity": ""});
			}
		},
		
		// toggle if we got an item or not
		toggle:function(){
			this.save({gotten: !this.get("gotten")});
		}
		// add more here
	});
	
	var AppState = Parse.Object.extend("AppState", {
		defaults: {
			filter: "all"
		}
	});
	
	// Shopping List Collection!
	var ShoppingList = Parse.Collection.extend({
		//ref to the collection's model
		model: ShoppingItem,
		
		// Filter by if we have the items already
		done: function() {
			return this.filter(function(shoppingitem){ return shoppingitem.get('gotten'); });
		},
		
		// Filter by if we do not have the items
		remaining: function(){
			return this.without.apply(this, this.done());
		},
	
		// generate order
		nextOrder: function(){
			if(!this.length) return 1;
			return this.last().get('order') + 1;
		},
		
		// sort by insertion order
		comparator: function(shoppingitem){
			return shoppingitem.get('order');
		}
	});
	
	// Shopping Item View
	var ShoppingItemView = Parse.View.extend({
		
		//list tag
		tagName: "li",
		
		template: _.template($('#item-template').html()),
		
		events: {
			"click .toggle" : "toggleDone",
			"dblclick label.item-content" : "edit",
			"click .item-destroy" : "clear",
			"keypress .edit" : "updateOnEnter",
			"blur .edit" : "close"
			// add more related to changing quantity, container
		},
		
		initialize: function(){
			_.bindAll(this, 'render', 'close', 'remove');
			this.model.bind('change', this.render);
			this.model.bind('destroy', this.remove);
		},
		
		render: function(){
			$(this.el).html(this.template(this.model.toJSON()));
			this.input = this.$('.edit');
			return this;
		},
		
		toggleDone: function(){
			this.model.toggle();
		},
		
		edit: function(){
			$(this.el).addClass("editing");
			this.input.focus();
		},
		
		close: function(){
			this.model.save({content: this.input.val()});
			// add other stuff here
			$(this.el).removeClass("editing");
		},
		
		updateOnEnter: function(e){
			if(e.keyCode == 13) this.close();
		},
		
		clear: function(){
			this.model.destroy();
		}
	});
	
	// The APP
	
	// Main View
	var ManageListView = Parse.View.extend({
		
		statsTemplate: _.template($('#stats-template').html()),
		
		events: {
			"keypress #new-item": "createOnEnter",
			"click #clear-done": "clearDone",
			"click #toggle-all": "toggleAllDone",
			"click .log-out": "logOut",
			"click ul#filters a": "selectFilter"
		},
		
		el: ".content",
		
		initialize:function(){
			var self = this;
			_.bindAll(this, 'addOne', 'addAll', 'addSome', 'render', 'toggleAllDone', 'logOut', 'createOnEnter');
			
			this.$el.html(_.template($("#manage-list-template").html()));
			
			this.input = this.$("#new-item");
			this.allDoneBox = this.$("#toggle-all")[0];
			
			this.list = new ShoppingList;
			
			this.list.query = new Parse.Query(ShoppingItem);
			this.list.query.equalTo("user", Parse.User.current());
			
			this.list.bind('add', this.addOne);
			this.list.bind('reset', this.addAll);
			this.list.bind('all', this.render);
			
			this.list.fetch();
			
			state.on("change", this.filter, this);
		},
		
		logOut: function(e) {
			Parse.User.logOut();
			new LogInView();
			this.undelegateEvents();
			delete this;
		},
		
		render: function() {
			var done = this.list.done().length;
			var remaining = this.list.remaining().length;
			
			this$('#list-stats').html(this.statsTemplate({
				total: this.list.length,
				done: done, 
				remaining: remaining
			}));
			
			this.delegateEvents();
			this.allDoneBox.checked = !remaining;
		},
		
		
		selectFilter: function(e) {
			var el = $(e.target);
			var filterValue = el.attr("id");
			state.set({filter: filterValue});
			Parse.history.navigate(filterValue);
		},
		
		filter: function(){
			var filterValue = state.get("filter");
			this.$("ul#filters a").removeClass("selected");
			this.$("ul#filters a#" + filterValue).addClass("selected");
			if(filterValue === "all"){
				this.addAll();
			}else if (filterValue === "completed"){
				this.addSome(function(shoppingitem) { return shoppingitem.get('done')});
			}else{
				this.addSome(function(shoppingitem) {return !shoppingitem.get('done')});
			}
		},
		
		resetFilters: function(){
			this.$("ul#filters a").removeClass("selected");
			this.$("ul#filters a#all").addClass("selected");
			this.addAll();
		},
		
		addOne: function(shoppingitem) {
			var view = new ShoppingItemView({model: shoppingitem});
			this.$("#item-list").append(view.render().el);
		},
		
		addAll: function(collection, filter) {
			this.$("#item-list").html("");
			this.list.each(this.addOne);
		},
		
		// add items based on the filter
		addSome: function(filter){
			var self = this;
			this.$("#item-list").html("");
			this.list.chain().filter(filter).each(function(shoppingitem) { self.addOne(shoppingitem) });
		},
		
		createOnEnter: function(e) {
			var self = this;
			if(e.keyCode != 13) return;
			
			this.list.create({
				content: this.input.val(),  // mess with this
				order: this.list.nextOrder(),
				gotten: false,
				user: Parse.User.current(),
				ACL: new Parse.ACL(Parse.User.current())
			});
			
			this.input.val('');
			this.resetFilters();
		},
		
		clearCompleted: function(){
			_.each(this.list.done(), function(shoppingitem){ shoppingitem.destroy(); });
			return false;
		},
		
		toggleAllDone: function() {
			var done = this.allDoneBox.checked;
			this.list.each(function(shoppingitem) { shoppingitem.save({'done': done}); });
		}
	});
	
});