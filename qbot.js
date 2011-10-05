/*
 * This is a primitive initial attempt at an AI player.
 * The design isn't great and maybe the whole thing should be rewritten -
 * the aim here is just to have something that basically works, and to
 * learn more about what's really needed for a decent AI design.
 *
 * The basic idea is we have a collection of independent modules
 * (EconomyManager, etc) which produce a list of plans.
 * The modules are mostly stateless - each turn they look at the current
 * world state, and produce some plans that will improve the state.
 * E.g. if there's too few worker units, they'll do a plan to train
 * another one. Plans are discarded after the current turn, if they
 * haven't been executed.
 *
 * Plans are grouped into a small number of PlanGroups, and for each
 * group we try to execute the highest-priority plans.
 * If some plan groups need more resources to execute their highest-priority
 * plan, we'll distribute any unallocated resources to that group's
 * escrow account. Eventually they'll accumulate enough to afford their plan.
 * (The purpose is to ensure resources are shared fairly between all the
 * plan groups - none of them should be starved even if they're trying to
 * execute a really expensive plan.)
 */

/*
 * Lots of things we should fix:
 *
 *  * Find entities with no assigned role, and give them something to do
 *  * Keep some units back for defence
 *  * Consistent terminology (type vs template etc)
 *  * ...
 *
 */

function QBotAI(settings) {
	BaseAI.call(this, settings);

	this.turn = 0;

	this.modules = [ new EconomyManager(), new MilitaryAttackManager(), new HousingManager() ];

	// this.queues cannot be modified past initialisation or queue-manager will break
	this.queues = {
		house : new Queue(),
		militaryUnit : new Queue(),
		villager : new Queue(),
		economicBuilding : new Queue(),
		field : new Queue(),
		militaryBuilding : new Queue(),
		defenceBuilding : new Queue(),
		civilCentre: new Queue()
	};

	this.productionQueues = [];
	
	var priorities = {
		house : 100,
		militaryUnit : 50,
		villager : 100,
		economicBuilding : 30,
		field: 4,
		militaryBuilding : 30,
		defenceBuilding: 5,
		civilCentre: 1000
	};
	this.queueManager = new QueueManager(this.queues, priorities);
	
	this.firstTime = true;

	this.savedEvents = [];
}

QBotAI.prototype = new BaseAI();

//Some modules need the gameState to fully initialise
QBotAI.prototype.runInit = function(gameState){
	if (this.firstTime){
		for (var i = 0; i < this.modules.length; i++){
			if (this.modules[i].init){
				this.modules[i].init(gameState);
			}
		}
		this.firstTime = false;
	}
};

QBotAI.prototype.OnUpdate = function() {

	if (this.events.length > 0){
		this.savedEvents = this.savedEvents.concat(this.events);
	}

	// Run the update every n turns, offset depending on player ID to balance
	// the load
	if ((this.turn + this.player) % 10 == 0) {
		Engine.ProfileStart("qBot");
		
		var gameState = new GameState(this);
		
		this.runInit(gameState);
		
		for (var i = 0; i < this.modules.length; i++){
			this.modules[i].update(gameState, this.queues, this.savedEvents);
		}
		
		this.queueManager.update(gameState);
		
		delete this.savedEvents;
		this.savedEvents = [];

		Engine.ProfileStop();
	}

	this.turn++;
};

var debugOn = false;

function debug(output){
	if (debugOn){
		if (typeof output === "string"){
			warn(output);
		}else{
			warn(uneval(output));
		}
	}
}

// TODO: Remove when the code gets patched in the common API
QBotAI.prototype.HandleMessage = function(state)
{
	if (!this._rawEntities)
	{
		// Do a (shallow) clone of all the initial entity properties (in order
		// to copy into our own script context and minimise cross-context
		// weirdness), and remember the entities owned by our player
		this._rawEntities = {};
		for (var id in state.entities)
		{
			var ent = state.entities[id];

			this._rawEntities[id] = {};
			for (var prop in ent)
				this._rawEntities[id][prop] = ent[prop];

			if (ent.owner === this._player)
				this._ownEntities[id] = this._rawEntities[id];
		}
	}
	else
	{
		this.ApplyEntitiesDelta(state);
	}

	Engine.ProfileStart("HandleMessage setup");

	this.entities = new EntityCollection(this, this._rawEntities);
	this.events = state.events;
	this.map = state.map;
	this.passabilityClasses = state.passabilityClasses;
	this.player = this._player;
	this.playerData = state.players[this._player];
	this.templates = this._templates;
	this.timeElapsed = state.timeElapsed;

	Engine.ProfileStop();

	this.OnUpdate();

	// Clean up temporary properties, so they don't disturb the serializer
	delete this.entities;
	delete this.events;
	delete this.map;
	delete this.passabilityClasses;
	delete this.player;
	delete this.playerData;
	delete this.templates;
	delete this.timeElapsed;
};
