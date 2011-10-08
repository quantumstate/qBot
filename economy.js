var EconomyManager = function() {
	this.targetNumWorkers = 60; // minimum number of workers we want
	this.targetNumBuilders = 5; // number of workers we want working on

	this.targetNumFields = 5;

	this.gatherWeights = {
		"food" : 150,
		"wood" : 100,
		"stone" : 50,
		"metal" : 100,
	};
	
	this.setCount = 0;
};

EconomyManager.prototype.init = function(gameState){
	this.targetNumWorkers = Math.floor(gameState.getPopulationMax()/3);
};

EconomyManager.prototype.trainMoreWorkers = function(gameState, queues) {
	// Count the workers in the world and in progress
	var numWorkers = gameState.countEntitiesAndQueuedWithRole("worker");
	numWorkers += queues.villager.countTotalQueuedUnits();

	// If we have too few, train more
	if (numWorkers < this.targetNumWorkers) {
		for ( var i = 0; i < this.targetNumWorkers - numWorkers; i++) {
			queues.villager.addItem(new UnitTrainingPlan(gameState, "units/{civ}_support_female_citizen", {
				"role" : "worker"
			}));
		}
	}
};

EconomyManager.prototype.pickMostNeededResources = function(gameState) {

	var self = this;

	// Find what resource type we're most in need of
	this.gatherWeights = gameState.ai.queueManager.futureNeeds(gameState);

	var numGatherers = {};
	for ( var type in this.gatherWeights)
		numGatherers[type] = 0;

	gameState.getOwnEntitiesWithRole("worker").forEach(function(ent) {
		if (ent.getMetadata("subrole") === "gatherer")
			numGatherers[ent.getMetadata("gather-type")] += 1;
	});

	var types = Object.keys(this.gatherWeights);
	types.sort(function(a, b) {
		// Prefer fewer gatherers (divided by weight)
		var va = numGatherers[a] / (self.gatherWeights[a]+1);
		var vb = numGatherers[b] / (self.gatherWeights[b]+1);
		return va-vb;
	});

	return types;
};

EconomyManager.prototype.reassignRolelessUnits = function(gameState) {
	//TODO: Move this out of the economic section
	var roleless = gameState.getOwnEntitiesWithRole(undefined);

	roleless.forEach(function(ent) {
		if (ent.hasClass("Worker")){
			ent.setMetadata("role", "worker");
		}else if(ent.hasClass("CitizenSoldier") || ent.hasClass("Super")){
			ent.setMetadata("role", "soldier");
		}else{
			ent.setMetadata("role", "unknown");
		}
	});
};

EconomyManager.prototype.setWorkersIdleByPriority = function(gameState){
	this.gatherWeights = gameState.ai.queueManager.futureNeeds(gameState);
	
	var numGatherers = {};
	var totalGatherers = 0;
	var totalWeight = 0;
	for ( var type in this.gatherWeights){
		numGatherers[type] = 0;
		totalWeight += this.gatherWeights[type];
	}

	gameState.getOwnEntitiesWithRole("worker").forEach(function(ent) {
		if (ent.getMetadata("subrole") === "gatherer"){
			numGatherers[ent.getMetadata("gather-type")] += 1;
			totalGatherers += 1;
		}
	});

	for ( var type in this.gatherWeights){
		var allocation = Math.floor(totalGatherers * (this.gatherWeights[type]/totalWeight));
		if (allocation < numGatherers[type]){
			var numToTake = numGatherers[type] - allocation;
			gameState.getOwnEntitiesWithRole("worker").forEach(function(ent) {
				if (ent.getMetadata("subrole") === "gatherer" && ent.getMetadata("gather-type") === type && numToTake > 0){
					ent.setMetadata("subrole", "idle");
					numToTake -= 1;
				}
			});
		}
	}
};

EconomyManager.prototype.reassignIdleWorkers = function(gameState) {
	
	var self = this;

	// Search for idle workers, and tell them to gather resources
	// Maybe just pick a random nearby resource type at first;
	// later we could add some timer that redistributes workers based on
	// resource demand.

	var idleWorkers = gameState.getOwnEntitiesWithRole("worker").filter(function(ent) {
		return (ent.isIdle() || ent.getMetadata("subrole") === "idle");
	});

	if (idleWorkers.length) {
		var resourceSupplies = gameState.findResourceSupplies();

		idleWorkers.forEach(function(ent) {

			var types = self.pickMostNeededResources(gameState);
			for ( var typeKey in types) {
				var type = types[typeKey];
				// Make sure there's actually some of that type
				if (!resourceSupplies[type])
					continue;

				// Pick the closest one.
				// TODO: we should care about distance to dropsites, not
				// (just) to the worker,
				// and gather rates of workers

				var workerPosition = ent.position();
				var supplies = [];
				resourceSupplies[type].forEach(function(supply) {
					// Skip targets that are too hard to hunt
					if (supply.entity.isUnhuntable())
						return;
					
					// And don't go for the bloody fish!
					if (supply.entity.hasClass("SeaCreature"))
						return;

					var dist = VectorDistance(supply.position, workerPosition);

					// Skip targets that are far too far away (e.g. in the
					// enemy base)
					if (dist > 512)
						return;

					supplies.push({
						dist : dist,
						entity : supply.entity
					});
				});

				supplies.sort(function(a, b) {
					// Prefer smaller distances
					if (a.dist != b.dist)
						return a.dist - b.dist;

					return false;
				});

				// Start gathering
				if (supplies.length) {
					ent.gather(supplies[0].entity);
					ent.setMetadata("subrole", "gatherer");
					ent.setMetadata("gather-type", type);
					return;
				}
			}

			// Couldn't find any types to gather
			ent.setMetadata("subrole", "idle");
		});
	}
};

EconomyManager.prototype.assignToFoundations = function(gameState) {
	// If we have some foundations, and we don't have enough
	// builder-workers,
	// try reassigning some other workers who are nearby

	var foundations = gameState.findFoundations();

	// Check if nothing to build
	if (!foundations.length)
		return;

	var workers = gameState.getOwnEntitiesWithRole("worker");

	var builderWorkers = workers.filter(function(ent) {
		return (ent.getMetadata("subrole") === "builder");
	});

	// Check if enough builders
	var extraNeeded = this.targetNumBuilders - builderWorkers.length;
	if (extraNeeded <= 0)
		return;

	// Pick non-builders who are closest to the first foundation,
	// and tell them to start building it

	var target = foundations.toEntityArray()[0];

	var nonBuilderWorkers = workers.filter(function(ent) {
		return (ent.getMetadata("subrole") !== "builder");
	});

	var nearestNonBuilders = nonBuilderWorkers.filterNearest(target.position(), extraNeeded);

	// Order each builder individually, not as a formation
	nearestNonBuilders.forEach(function(ent) {
		ent.repair(target);
		ent.setMetadata("subrole", "builder");
	});
};

EconomyManager.prototype.buildMoreFields = function(gameState, queues) {
	// give time for treasures to be gathered
	if (gameState.getTimeElapsed() < 30 * 1000)
		return;
	var numFields = gameState.countEntitiesAndQueuedWithType(gameState.applyCiv("structures/{civ}_field"));
	numFields += queues.field.totalLength();

	for ( var i = numFields; i < this.targetNumFields; i++) {
		queues.field.addItem(new BuildingConstructionPlan(gameState, "structures/{civ}_field"));
	}
};

EconomyManager.prototype.buildNewCC= function(gameState, queues) {
	var numCCs = gameState.countEntitiesAndQueuedWithType(gameState.applyCiv("structures/{civ}_civil_centre"));
	numCCs += queues.civilCentre.totalLength();

	for ( var i = numCCs; i < 1; i++) {
		queues.civilCentre.addItem(new BuildingConstructionPlan(gameState, "structures/{civ}_civil_centre"));
	}
};

//creates and maintains a map of tree density
EconomyManager.prototype.updateTreeMap = function(gameState, events){
	// if there is no treeMap create one with an influence for everything with wood resource
	var decreaseFactor = 15;
	
	if (! this.treeMap){
		this.treeMap = new Map(gameState);

		var supplies = gameState.findResourceSupplies();
		for (i in supplies['wood']){
			var current = supplies['wood'][i];
			var x = Math.round(current.position[0] / gameState.cellSize);
			var z = Math.round(current.position[1] / gameState.cellSize);
			this.treeMap.addInfluence(x, z, Math.round(current.entity.resourceSupplyMax()/decreaseFactor));
		}
	}
	// Look for destroy events and subtract the entities original influence from the treeMap
	for (i in events) {
		var e = events[i];

		if (e.type === "Destroy") {
			var ent = new Entity(gameState.ai, e.msg.rawEntity);
			if (ent && ent.resourceSupplyType() && ent.resourceSupplyType().generic === 'wood'){
				var x = Math.round(ent.position()[0] / gameState.cellSize);
				var z = Math.round(ent.position()[1] / gameState.cellSize);
				
				this.treeMap.addInfluence(x, z, Math.round(ent.resourceSupplyMax()/decreaseFactor), -1);
			}
		}
	}
	
	this.treeMap.dumpIm("tree_density.png");
};

EconomyManager.prototype.getBestForestBuildSpot = function(gameState){
	
	var friendlyTiles = new Map(gameState);
	gameState.getOwnEntities().forEach(function(ent) {
		if (ent.hasClass("CivCentre")){
			var infl = 90;

			var pos = ent.position();
			var x = Math.round(pos[0] / gameState.cellSize);
			var z = Math.round(pos[1] / gameState.cellSize);
			friendlyTiles.addInfluence(x, z, infl, 0.3);
		}
		if (ent.resourceDropsiteTypes() && ent.resourceDropsiteTypes().indexOf("wood") !== -1){
			var infl = 20;
			
			var pos = ent.position();
			var x = Math.round(pos[0] / gameState.cellSize);
			var z = Math.round(pos[1] / gameState.cellSize);
			
			friendlyTiles.addInfluence(x, z, infl, -100);
		}
	});
	
	friendlyTiles.multiply(this.treeMap);
	
	friendlyTiles.dumpIm("tree_density_fade.png", 10000);
	
	var obstructions = Map.createObstructionMap(gameState);
	obstructions.expandInfluences();
	
	var bestIdx = friendlyTiles.findBestTile(4, obstructions)[0];
	
	var x = ((bestIdx % friendlyTiles.width) + 0.5) * gameState.cellSize;
	var z = (Math.floor(bestIdx / friendlyTiles.width) + 0.5) * gameState.cellSize;
	
	return [x,z];
};

EconomyManager.prototype.update = function(gameState, queues, events) {
	Engine.ProfileStart("economy update");
	
	this.reassignRolelessUnits(gameState);
	
	this.buildNewCC(gameState,queues);

	Engine.ProfileStart("Train workers and build farms");
	this.trainMoreWorkers(gameState, queues);

	this.buildMoreFields(gameState, queues);
	Engine.ProfileStop();
	
	//Later in the game we want to build stuff faster.
	if (gameState.countEntitiesWithType(gameState.applyCiv("units/{civ}_support_female_citizen")) > 50) {
		this.targetNumBuilders = 10;
	}else{
		this.targetNumBuilders = 5;
	}
	
	Engine.ProfileStart("Update Tree Map");
	this.updateTreeMap(gameState, events);
	Engine.ProfileStop();
	
	if (gameState.getTimeElapsed() > 30 * 1000){
		var numMills = gameState.countEntitiesAndQueuedWithType(gameState.applyCiv("structures/{civ}_mill"));
		numMills += queues.economicBuilding.totalLength();
		if (numMills < 1){
			var spot = this.getBestForestBuildSpot(gameState);
			queues.economicBuilding.addItem(new BuildingConstructionPlan(gameState, "structures/{civ}_mill", spot));
		}
	}
	
	if (gameState.getTimeElapsed() > 300 * 1000){
		var numMills = gameState.countEntitiesAndQueuedWithType(gameState.applyCiv("structures/{civ}_mill"));
		numMills += queues.economicBuilding.totalLength();
		if (numMills < 2){
			var spot = this.getBestForestBuildSpot(gameState);
			queues.economicBuilding.addItem(new BuildingConstructionPlan(gameState, "structures/{civ}_mill", spot));
		}
	}
	
	this.setCount += 1;
	if (this.setCount >= 20){
		this.setWorkersIdleByPriority(gameState);
		this.setCount = 0;
	}

	this.reassignIdleWorkers(gameState);

	this.assignToFoundations(gameState);

	Engine.ProfileStop();
};
