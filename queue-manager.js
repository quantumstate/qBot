//This takes the input queues and picks which items to fund with resources until no more resources are left to distribute.
//
//In this manager all resources are 'flattened' into a single type=(food+wood+metal+stone+pop*50 (see resources.js))
//the following refers to this simple as resource
//
// Each queue has an account which records the amount of resource it can spend.  If no queue has an affordable item
// then the amount of resource is increased to all accounts in direct proportion to the priority until an item on one
// of the queues becomes affordable.
//
// A consequence of the system is that a rarely used queue will end up with a very large account.  I am unsure if this
// is good or bad or neither.

var QueueManager = function(queues, priorities) {
	this.queues = queues;
	this.priorities = priorities;
	this.account = {};
	for (p in this.queues) {
		this.account[p] = 0;
	}
	this.curItemQueue = undefined;
};

QueueManager.prototype.getAvailableResources = function(gameState){
	var resources = gameState.getResources();
	for (key in this.queues){
		resources.subtract(this.queues[key].outQueueCost());
	} 
	return resources;
};

QueueManager.prototype.futureNeeds = function(){
	// TODO: make prediction more accurate
	//var futureNum = 20;
	var needs = new Resources();
	for (i in this.queues){
		var queueNeeds = new Resources();
		for (var j = 0; j < Math.min(10, this.queues[i].length()); j++){
			queueNeeds.add(this.queues[i].queue[j].getCost());
		}
		queueNeeds.multiply(this.priorities[i]);
		needs.add(queueNeeds);
	}
	return {"food": needs.food,
	        "wood": needs.wood,
	        "stone": needs.stone,
	        "metal": needs.metal};
};

QueueManager.prototype.update = function(gameState) {
	var resources = this.getAvailableResources(gameState);
	if (this.curItemQueue) {
		if (resources.canAfford(this.queues[this.curItemQueue].getNext().getCost())) {
			this.queues[this.curItemQueue].nextToOutQueue();
			resources = this.getAvailableResources(gameState);
			this.curItemQueue = undefined;
		}
	}
	
	var curItemQueue = this.curItemQueue;
	while (curItemQueue === undefined) {
		// pick out most affordable item (increasing accounts in necessary)
		var ratio = {};
		var ratioMin = 1000000;
		var ratioMinQueue = undefined;
		for (p in this.queues) {
			if (this.queues[p].length() > 0) {
				var cost = this.queues[p].getNext().getCost().toInt();
				if (cost < this.account[p]) {
					curItemQueue = p;
					break;
				} else {
					ratio[p] = (cost - this.account[p]) / this.priorities[p];
					//warn(cost);
					if (ratio[p] < ratioMin) {
						ratioMin = ratio[p];
						ratioMinQueue = p;
					}
				}
			}
		}

		// Checks to see that there is an item in at least one queue, otherwise breaks the loop.
		if (curItemQueue === undefined && ratioMinQueue === undefined){
			break;
		}
		
		if (curItemQueue === undefined) {
			for (p in this.queues) {
				this.account[p] += ratioMin * this.priorities[p];
			}
			this.account[ratioMinQueue] -= this.queues[ratioMinQueue].getNext().getCost().toInt();
			curItemQueue = ratioMinQueue;			
		}
		
		if (curItemQueue) {
			if (resources.canAfford(this.queues[curItemQueue].getNext().getCost())) {
				this.queues[curItemQueue].nextToOutQueue();
				resources = this.getAvailableResources(gameState);
				curItemQueue = undefined;
			}
		}
		// Check to see if selected item is affordable and if so execute it

	}
	this.curItemQueue = curItemQueue;
	
	// Handle output queues
	// TODO: Handle multiple units in queue for faster training times - partially done, need to hold queue before sending to a building
	for (p in this.queues) {
		while (this.queues[p].outQueueLength() > 0){
			var next = this.queues[p].outQueueNext();
			if (next.category === "building"){
				if (gameState.buildingsBuilt == 0){
					this.queues[p].executeNext(gameState);
					gameState.buildingsBuilt += 1;
				}else{
					break;
				}
			}else{
				this.queues[p].executeNext(gameState);
			}
		}
	}
};
