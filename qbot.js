
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
		militaryUnit : 100,
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
	if (this.gameFinished){
		returnl
	}
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
QBotAI.prototype.ApplyEntitiesDelta = function(state)
{
	Engine.ProfileStart("ApplyEntitiesDelta");

	for each (var evt in state.events)
	{
		if (evt.type == "Create")
		{
			this._rawEntities[evt.msg.entity] = {};
		}
		else if (evt.type == "Destroy")
		{
			evt.msg.metadata = (evt.msg.metadata || []);
			evt.msg.rawEntity = (evt.msg.rawEntity || this._rawEntities[evt.msg.entity]);
			
			evt.msg.metadata[this._player] = this._entityMetadata[evt.msg.entity];
			
			delete this._rawEntities[evt.msg.entity];
			delete this._entityMetadata[evt.msg.entity];
			delete this._ownEntities[evt.msg.entity];
		}
		else if (evt.type == "TrainingFinished")
		{
			// Apply metadata stored in training queues, but only if they
			// look like they were added by us
			if (evt.msg.owner === this._player)
				for each (var ent in evt.msg.entities)
					this._entityMetadata[ent] = ShallowClone(evt.msg.metadata);
		}
	}

	for (var id in state.entities)
	{
		var changes = state.entities[id];

		if ("owner" in changes)
		{
			var wasOurs = (this._rawEntities[id].owner !== undefined
				&& this._rawEntities[id].owner === this._player);

			var isOurs = (changes.owner === this._player);

			if (wasOurs && !isOurs)
				delete this._ownEntities[id];
			else if (!wasOurs && isOurs)
				this._ownEntities[id] = this._rawEntities[id];
		}

		for (var prop in changes)
			this._rawEntities[id][prop] = changes[prop];
	}

	Engine.ProfileStop();
};
