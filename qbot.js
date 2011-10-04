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
	// warn("Constructing TestBotAI for player "+settings.player);

	BaseAI.call(this, settings);

	this.turn = 0;

	this.modules = [ new EconomyManager(), new MilitaryAttackManager(), new HousingManager() ];

	// this.queues cannot be modified past initialisation or queue-manager will break
	this.queues = {
		house : new Queue(),
		villager : new Queue(),
		economicBuilding : new Queue(),
		field : new Queue(),
		militaryBuilding : new Queue(),
		defenceBuilding : new Queue(),
		militaryUnit : new Queue(),
		civilCentre: new Queue()
	};

	this.productionQueues = [];
	
	var priorities = {
		house : 100,
		villager : 100,
		economicBuilding : 30,
		field: 4,
		militaryBuilding : 30,
		defenceBuilding: 5,
		militaryUnit : 30,
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

