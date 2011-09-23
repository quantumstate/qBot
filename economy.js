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
};

EconomyManager.prototype.buildMoreBuildings = function(gameState, planGroups) {
	// Limit ourselves to constructing one building at a time
	if (gameState.findFoundations().length)
		return;

	for ( var buildingKey in this.targetBuildings) {
		var building = this.targetBuildings[buildingKey];
		var numBuildings = gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(building.template));

		// If we have too few, build another
		if (numBuildings < building.count) {
			planGroups.economyConstruction.addPlan(building.priority, new BuildingConstructionPlan(gameState,
					building.template));
		}
	}
};

EconomyManager.prototype.trainMoreWorkers = function(gameState, queues) {
	// Count the workers in the world and in progress
	var numWorkers = gameState.countEntitiesAndQueuedWithRole("worker");
	numWorkers += queues.villager.length();

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
	this.gatherWeights = gameState.ai.queueManager.futureNeeds();

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
		var va = numGatherers[a] / self.gatherWeights[a];
		var vb = numGatherers[b] / self.gatherWeights[b];
		return va - vb;
	});

	return types;
};

EconomyManager.prototype.reassignRolelessUnits = function(gameState) {
	var roleless = gameState.getOwnEntitiesWithRole(undefined);

	roleless.forEach(function(ent) {
		if (ent.hasClass("Worker"))
			ent.setMetadata("role", "worker");
		else
			ent.setMetadata("role", "unknown");
	});
};

EconomyManager.prototype.reassignIdleWorkers = function(gameState) {
	var self = this;

	// Search for idle workers, and tell them to gather resources
	// Maybe just pick a random nearby resource type at first;
	// later we could add some timer that redistributes workers based on
	// resource demand.

	var idleWorkers = gameState.getOwnEntitiesWithRole("worker").filter(function(ent) {
		return ent.isIdle();
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
	var numFields = gameState.countEntitiesAndQueuedWithType(gameState.applyCiv("structures/{civ}_field"));
	numFields += queues.field.totalLength();

	for ( var i = numFields; i < this.targetNumFields; i++) {
		queues.field.addItem(new BuildingConstructionPlan(gameState, "structures/{civ}_field"));
	}
};

EconomyManager.prototype.update = function(gameState, queues) {
	Engine.ProfileStart("economy update");

	this.reassignRolelessUnits(gameState);

	Engine.ProfileStart("Train workers and build farms");
	this.trainMoreWorkers(gameState, queues);

	this.buildMoreFields(gameState, queues);
	Engine.ProfileStop();

	this.reassignIdleWorkers(gameState);

	this.assignToFoundations(gameState);

	Engine.ProfileStop();
};
