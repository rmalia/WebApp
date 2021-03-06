
$(function() {

  Parse.$ = jQuery;
  var appID = "v5kNbIElGVV18SSkrtsyKLmZVQMVrwkzi40UrJon";
  var jsKey = "w0JoSTnwKacim06SkLesEKEZxAjVxUrLq9uWbLK6";

  // Initialize Parse with your Parse application javascript keys
  Parse.initialize(appID,
                   jsKey);

  // ShoppingItem Model
  // ----------

  // Our basic ShoppingItem model has `content`, `order`, and `done` attributes.
  var ShoppingItem = Parse.Object.extend("ShoppingItem", {
    // Default attributes for the item.
    defaults: {
      content: "empty entry...",
      done: false,
	  quantity: 0
    },

    // Ensure that each item created has `content`.
    initialize: function() {
      if (!this.get("content")) {
        this.set({"content": this.defaults.content});
      }
    },

	// increment quantity of the item
    increment: function() {
		var inc = this.get("quantity");
		inc++;
		this.save({"quantity": inc});
	},
		
	//decrement quantity of the item
	decrement: function(){
		var dec = this.get("quantity");
		// no negatives
		if(dec > 0){
			dec--;
			this.save({"quantity": dec});
		}
	},
	
    // Toggle the `done` state of this item.
    toggle: function() {
      this.save({done: !this.get("done")});
    }
  });

  // This is the transient application state, not persisted on Parse
  var AppState = Parse.Object.extend("AppState", {
    defaults: {
      filter: "all"
    }
  });

  // ShoppingItem Collection
  // ---------------

  var ShoppingItemList = Parse.Collection.extend({

    // Reference to this collection's model.
    model: ShoppingItem,

    // Filter down the list of all items that are gotten.
    done: function() {
      return this.filter(function(shopitem){ return shopitem.get('done'); });
    },

    // Filter down the list to only items that are not gotten
    remaining: function() {
      return this.without.apply(this, this.done());
    },

    //Order generator
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1;
    },

    // Sort by their original insertion order.
    comparator: function(shopitem) {
      return shopitem.get('order');
    }

  });

  // ShoppingItem Item View

  var ShoppingItemView = Parse.View.extend({
    tagName:  "li",

    // Cache the template function for a single item.
    template: _.template($('#item-template').html()),

    // The DOM events specific to an item.
    events: {
      "click .toggle"              : "toggleDone",
      "dblclick label.item-content" : "edit",
      "click .item-destroy"   : "clear",
      "keypress .edit"      : "updateOnEnter",
      "blur .edit"          : "close",
	  "click .plus"			: "increment",
	  "click .minus"		: "decrement"
    },

    // The ShoppingItemView listens for changes to its model, re-rendering. Since there's
    // a one-to-one correspondence between a ShoppingItem and a ShoppingItemView in this
    // app, we set a direct reference on the model for convenience.
    initialize: function() {
      _.bindAll(this, 'render', 'close', 'remove');
      this.model.bind('change', this.render);
      this.model.bind('destroy', this.remove);
    },

    // Re-render the contents of item.
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.input = this.$('.edit');
      return this;
    },

    // Toggle the `"done"` state of the model.
    toggleDone: function() {
      this.model.toggle();
    },

    // Switch this view into `"editing"` mode, displaying the input field.
    edit: function() {
      $(this.el).addClass("editing");
      this.input.focus();
    },

    // Close the `"editing"` mode, saving changes.
    close: function() {
      this.model.save({content: this.input.val()});
      $(this.el).removeClass("editing");
    },

    // If you hit `enter`, we're through editing the item.
    updateOnEnter: function(e) {
      if (e.keyCode == 13) this.close();
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.destroy();
    },
	
	// increment the quantity of the item
	increment: function(){
		this.model.increment();
	},
	
	// decrement the quantity of the item
	decrement: function(){
		this.model.decrement();
	}

  });

  // The Application
  // ---------------

  // The main view that lets a user manage their items
  var ManageListView = Parse.View.extend({

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: _.template($('#stats-template').html()),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "keypress #new-item":  "createOnEnter",
      "click #clear-completed": "clearCompleted",
      "click #toggle-all": "toggleAllComplete",
      "click .log-out": "logOut",
      "click ul#filters a": "selectFilter"
    },

    el: ".content",

    // At initialization we bind to the relevant events on the `Todos`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting todos that might be saved to Parse.
    initialize: function() {
      var self = this;

      _.bindAll(this, 'addOne', 'addAll', 'addSome', 'render', 'toggleAllComplete', 'logOut', 'createOnEnter');

      // Main management template
      this.$el.html(_.template($("#manage-list-template").html()));
      
      this.input = this.$("#new-item");
      this.allCheckbox = this.$("#toggle-all")[0];

      // Create our collection of shopping items
      this.list = new ShoppingItemList;

      // Setup the query for the collection to look for the list from the current user
      this.list.query = new Parse.Query(ShoppingItem);
      this.list.query.equalTo("user", Parse.User.current());
        
      this.list.bind('add',     this.addOne);
      this.list.bind('reset',   this.addAll);
      this.list.bind('all',     this.render);

      // Fetch all the items for this user
      this.list.fetch();

      state.on("change", this.filter, this);
    },

    // Logs out the user and shows the login view
    logOut: function(e) {
      Parse.User.logOut();
      new LogInView();
      this.undelegateEvents();
      delete this;
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      var done = this.list.done().length;
      var remaining = this.list.remaining().length;

      this.$('#list-stats').html(this.statsTemplate({
        total:      this.list.length,
        done:       done,
        remaining:  remaining
      }));

      this.delegateEvents();

      this.allCheckbox.checked = !remaining;
    },

    // Filters the list based on which type of filter is selected
    selectFilter: function(e) {
      var el = $(e.target);
      var filterValue = el.attr("id");
      state.set({filter: filterValue});
      Parse.history.navigate(filterValue);
    },

	// filter the viewable items based on input
    filter: function() {
      var filterValue = state.get("filter");
      this.$("ul#filters a").removeClass("selected");
      this.$("ul#filters a#" + filterValue).addClass("selected");
      if (filterValue === "all") {
        this.addAll();
      } else if (filterValue === "completed") {
        this.addSome(function(item) { return item.get('done') });
      } else {
        this.addSome(function(item) { return !item.get('done') });
      }
    },

    // Resets the filters to display all items
    resetFilters: function() {
      this.$("ul#filters a").removeClass("selected");
      this.$("ul#filters a#all").addClass("selected");
      this.addAll();
    },

    // Add a single item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(shopitem) {
      var view = new ShoppingItemView({model: shopitem});
      this.$("#shopping-list").append(view.render().el);
    },

    // Add all items in the collection at once.
    addAll: function(collection, filter) {
      this.$("#shopping-list").html("");
      this.list.each(this.addOne);
    },

    // Only adds some items, based on a filtering function that is passed in
    addSome: function(filter) {
      var self = this;
      this.$("#shopping-list").html("");
      this.list.chain().filter(filter).each(function(item) { self.addOne(item) });
    },

    // If you hit return in the main input field, create new ShoppingItem model
    createOnEnter: function(e) {
      var self = this;
      if (e.keyCode != 13) return;

      this.list.create({
        content: this.input.val(),
        order:   this.list.nextOrder(),
        done:    false,
        user:    Parse.User.current(),
        ACL:     new Parse.ACL(Parse.User.current())
      });

      this.input.val('');
      this.resetFilters();
    },

    // Clear all done items, destroying their models.
    clearCompleted: function() {
      _.each(this.list.done(), function(shopitem){ shopitem.destroy(); });
      return false;
    },

	// make everything checks
    toggleAllComplete: function () {
      var done = this.allCheckbox.checked;
      this.list.each(function (shopitem) { shopitem.save({'done': done}); });
    }
  });

  var LogInView = Parse.View.extend({
    events: {
      "submit form.login-form": "logIn",
      "submit form.signup-form": "signUp"
    },

    el: ".content",
    
    initialize: function() {
      _.bindAll(this, "logIn", "signUp");
      this.render();
    },

	// Login
    logIn: function(e) {
      var self = this;
      var username = this.$("#login-username").val();
      var password = this.$("#login-password").val();
      
      Parse.User.logIn(username, password, {
        success: function(user) {
          new ManageListView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".login-form .error").html("Invalid username or password. Please try again.").show();
          this.$(".login-form button").removeAttr("disabled");
        }
      });

      this.$(".login-form button").attr("disabled", "disabled");

      return false;
    },

	// Sign up
    signUp: function(e) {
      var self = this;
      var username = this.$("#signup-username").val();
      var password = this.$("#signup-password").val();
      
      Parse.User.signUp(username, password, { ACL: new Parse.ACL() }, {
        success: function(user) {
          new ManageListView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".signup-form .error").html(error.message).show();
          this.$(".signup-form button").removeAttr("disabled");
        }
      });

      this.$(".signup-form button").attr("disabled", "disabled");

      return false;
    },

    render: function() {
      this.$el.html(_.template($("#login-template").html()));
      this.delegateEvents();
    }
  });

  // The main view for the app
  var AppView = Parse.View.extend({
    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#shoppingapp"),

    initialize: function() {
      this.render();
    },

    render: function() {
      if (Parse.User.current()) {
        new ManageListView();
      } else {
        new LogInView();
      }
    }
  });

  var AppRouter = Parse.Router.extend({
    routes: {
      "all": "all",
      "active": "active",
      "completed": "completed"
    },

    initialize: function(options) {
    },

	// set filter to all
    all: function() {
      state.set({ filter: "all" });
    },

	// set filter to remaining items
    active: function() {
      state.set({ filter: "active" });
    },

	// set filter to already gotten items
    completed: function() {
      state.set({ filter: "completed" });
    }
  });

  var state = new AppState;

  new AppRouter;
  new AppView;
  Parse.history.start();
});
