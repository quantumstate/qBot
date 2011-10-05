/*
 * Military strategy:
 *   * Try training an attack squad of a specified size
 *   * When it's the appropriate size, send it to attack the enemy
 *   * Repeat forever
 *
 */

var MilitaryAttackManager = function() {
	this.targetSquadSize = 10;
	this.squadTypes = [ "units/{civ}_infantry_spearman_b", "units/{civ}_infantry_javelinist_b" ];

	// these use the structure soldiers[unitId] = true|false to register the
	// units
	this.soldiers = {};
	this.assigned = {};
	this.unassigned = {};
	// this.enemyAttackers = {};

	// units
	this.uCivBasic = {};
	this.uCivModerate = {};
	this.uCivAdvanced = {};
	this.uCivBasic.hele = [ "units/{civ}_infantry_spearman_b", "units/{civ}_infantry_javelinist_b",	"units/{civ}_cavalry_swordsman_b" ];
	this.uCivModerate.hele = [ "units/{civ}_cavalry_javelinist_b", "units/{civ}_infantry_archer_b" ];
	this.uCivAdvanced.hele = [ "units/{civ}_champion_cavalry_mace", "units/{civ}_champion_infantry_mace", "units/{civ}_champion_infantry_polis", "units/{civ}_champion_ranged_polis" ];

	this.uCivBasic.cart = [ "units/{civ}_infantry_spearman_b", "units/{civ}_infantry_archer_b", "units/{civ}_cavalry_javelinist_b" ];
	this.uCivModerate.cart = [];
	this.uCivAdvanced.cart = [ "units/{civ}_champion_cavalry", "units/{civ}_infantry_swordsman_2_b", "units/{civ}_cavalry_spearman_b", "units/{civ}_infantry_javelinist_b", "units/{civ}_infantry_slinger_b", "units/{civ}_cavalry_swordsman_b", "units/{civ}_infantry_swordsman_b", "units/{civ}_cavalry_swordsman_2_b" ];

	this.uCivBasic.celt = [ "units/{civ}_infantry_spearman_b", "units/{civ}_infantry_javelinist_b", "units/{civ}_cavalry_javelinist_b" ];
	this.uCivModerate.celt = [ "units/{civ}_cavalry_swordsman_b" ];
	this.uCivAdvanced.celt = [ "units/{civ}_champion_cavalry_gaul", "units/{civ}_champion_infantry_gaul", "units/{civ}_champion_cavalry_brit", "units/{civ}_champion_infantry_brit" ];

	this.uCivBasic.iber = [ "units/{civ}_infantry_swordsman_b", "units/{civ}_infantry_javelinist_b", "units/{civ}_cavalry_spearman_b" ];
	this.uCivModerate.iber = [ "units/{civ}_infantry_spearman_b", "units/{civ}_infantry_slinger_b" ];
	this.uCivAdvanced.iber = [ "units/{civ}_champion_cavalry", "units/{civ}_champion_infantry" ];

	// buildings
	this.bModerate = [ "structures/{civ}_barracks" ];

	this.bCivAdvanced = {};
	this.bCivAdvanced.hele = [ "structures/{civ}_gymnasion" ];
	this.bCivAdvanced.cart = [ "structures/{civ}_fortress", "structures/{civ}_embassy_celtic", "structures/{civ}_embassy_iberian", "structures/{civ}_embassy_italiote" ];

	this.attackManager = new WalkToCC();
};

MilitaryAttackManager.prototype.init = function(gameState) {
	var civ = gameState.playerData.civ;
	if (civ in this.uCivBasic) {
		this.uBasic = this.uCivBasic[civ];
		this.uModerate = this.uCivModerate[civ];
		this.uAdvanced = this.uCivAdvanced[civ];

		this.bAdvanced = this.bCivAdvanced[civ];
	}
};


/**
 * @param (GameState) gameState
 * @returns array of soldiers for which training buildings exist
 */
MilitaryAttackManager.prototype.findTrainableUnits = function(gameState){
	var ret = [];
	gameState.getOwnEntities().forEach(function(ent) {
		var trainable = ent.trainableEntities();
		for (i in trainable){
			var template = new EntityTemplate(gameState.ai.GetTemplate(trainable[i]));
			if (template.hasClass("CitizenSoldier") || template.hasClass("Super")){
				if (ret.indexOf(trainable[i]) === -1){
					ret.push(trainable[i]);
				}
			}
		}
		return true;
	});
	return ret;
};

/**
 * Returns the unit type we should begin training. (Currently this is whatever
 * we have least of.)
 */
MilitaryAttackManager.prototype.findBestNewUnit = function(gameState, queues) {
	var units = this.findTrainableUnits(gameState);
	// Count each type
	var types = [];
	for ( var tKey in units) {
		var t = units[tKey];
		types.push([t, gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(t))
						+ queues.militaryUnit.countAllByType(gameState.applyCiv(t)) ]);
	}

	// Sort by increasing count
	types.sort(function(a, b) {
		return a[1] - b[1];
	});

	// TODO: we shouldn't return units that we don't have any
	// buildings capable of training

	return types[0][0];
};

MilitaryAttackManager.prototype.attackElephants = function(gameState) {
	var eles = gameState.entities.filter(function(ent) {
		return (ent.templateName().indexOf("elephant") > -1);
	});

	warn(uneval(eles._entities));
};

MilitaryAttackManager.prototype.registerSoldiers = function(gameState) {
	var soldiers = gameState.getOwnEntitiesWithRole("soldier");
	var self = this;

	soldiers.forEach(function(ent) {
		ent.setMetadata("role", "registeredSoldier");
		//ent.setMetadata("role", "attack-pending");
		self.soldiers[ent.id()] = true;
		self.unassigned[ent.id()] = true;
	});
};

MilitaryAttackManager.prototype.defence = function(gameState) {
	var ents = gameState.entities._entities;

	var myCivCentres = gameState.getOwnEntities().filter(function(ent) {
		return ent.hasClass("CivCentre");
	});

	if (myCivCentres.length === 0)
		return;

	var defenceRange = 200; // just beyond town centres territory influence
	var nearby = [];
	var defendersPerAttacker = 3;

	myCivCentres.forEach(function(ent) {
		var pos = ent.position();
		gameState.entities
				.forEach(function(ent) {
					if (gameState.playerData.isEnemy[ent.owner()]
							&& (ent.hasClass("CitizenSoldier") || ent.hasClass("Super"))) {
						var distSquared = (ent.position()[0] - pos[0]) * (ent.position()[0] - pos[0])
								+ (ent.position()[1] - pos[1]) * (ent.position()[1] - pos[1]);
						if (distSquared < defenceRange * defenceRange) {
							nearby.push(ent.id());
						}
					}
				});
	});

	delete this.enemyAttackers;
	this.enemyAttackers = {};
	for (i in nearby) {
		this.enemyAttackers[nearby[i]] = true;
	}

	for (id in this.enemyAttackers) {
		var ent = new Entity(gameState.ai, ents[id]);
		if (ent.getMetadata("attackers") === undefined || ent.getMetadata("attackers").length < defendersPerAttacker) {
			var tasked = this.getAvailableUnits(3);
			//warn(uneval(tasked));
			if (tasked.length > 0) {
				Engine.PostCommand({
					"type" : "attack",
					"entities" : tasked,
					"target" : ent.id(),
					"queued" : false
				});
				ent.setMetadata("attackers", tasked);
				for (i in tasked) {
					this.entity(tasked[i]).setMetadata("attacking", id);
				}
			} else {
				break;
			}
		}
	}
};

// return n available units and makes these units unavailable
MilitaryAttackManager.prototype.getAvailableUnits = function(n) {
	var ret = [];
	var count = 0;
	for (i in this.unassigned) {
		ret.push(+i);
		delete this.unassigned[i];
		this.assigned[i] = true;
		count++;
		if (count >= n) {
			break;
		}
	}
	return ret;
};

MilitaryAttackManager.prototype.countAvailableUnits = function(){
	var count = 0;
	for (i in this.unassigned){
		if (this.unassigned[i]){
			count += 1;
		}
	}
	return count;
};

MilitaryAttackManager.prototype.handleEvents = function(gameState, events) {
	for (i in events) {
		var e = events[i];

		if (e.type === "Destroy") {
			var id = e.msg.entity;
			delete this.unassigned[id];
			delete this.assigned[id];
			delete this.soldiers[id];
			var metadata = e.msg.metadata[gameState.ai._player];
			if (metadata && metadata.attacking){
				var attacking = this.entity(metadata.attacking);
				if (attacking){
					var attackers = attacking.getMetadata('attackers');
					attackers.splice(attackers.indexOf(metadata.attacking), 1);
					attacking.setMetadata('attackers', attackers);
				}
			}
			if (metadata && metadata.attackers){
				for (i in metadata.attackers){
					var attacker = this.entity(metadata.attackers[i]);
					if (attacker){
						attacker.deleteMetadata('attacking');
						this.unassigned[attacker.id()] = true;
						this.assigned[attacker.id()] = false;
					}
				}
			}
		}
	}
	// ({type:"Destroy", msg:{entity:1131}})({type:"Destroy",
	// msg:{entity:1117}})({type:"Destroy", msg:{entity:1114}})%
};

MilitaryAttackManager.prototype.entity = function(id) {
	if (this.gameState.entities._entities[id]) {
		return new Entity(this.gameState.ai, this.gameState.entities._entities[id]);
	}else{
		debug("Entity " + id + " requested does not exist");
	}
	return false;
};

MilitaryAttackManager.prototype.measureEnemyStrength = function(gameState){
	// Measure enemy strength
	var isEnemy = gameState.playerData.isEnemy;
	var enemyStrength = [];
	var maxStrength = 0;
	for ( var i = 1; i < isEnemy.length; i++) {
		if (isEnemy[i]) {
			// var enemyEntities = gameState.getEntitiesByPlayer(i);
			var count = 0;
			gameState.entities.forEach(function(ent) {
				if (ent.owner() === i && (ent.hasClass("CitizenSoldier") || ent.hasClass("Super"))) {
					count++;
				}
			});
			enemyStrength[i] = count;
			if (count > maxStrength) {
				maxStrength = count;
			}
		}
	}
	
	return maxStrength;
};

MilitaryAttackManager.prototype.buildDefences = function(gameState, queues){ 
	if (gameState.countEntitiesAndQueuedWithType(gameState.applyCiv('structures/{civ}_scout_tower'))
			+ queues.defenceBuilding.totalLength() < 6) {
		queues.defenceBuilding.addItem(new BuildingConstructionPlan(gameState, 'structures/{civ}_scout_tower'));
	}
};

MilitaryAttackManager.prototype.update = function(gameState, queues, events) {

	// Pause for a minute before starting any work, to give the economy a chance to start up
	// if (gameState.getTimeElapsed() < 60 * 1000)
		// return;

	Engine.ProfileStart("military update");
	this.gameState = gameState;

	this.handleEvents(gameState, events);

	//warn(uneval(this.assigned));
	//warn(uneval(this.unassigned));

	// this.attackElephants(gameState);
	this.registerSoldiers(gameState);
	this.defence(gameState);
	this.buildDefences(gameState, queues);

	// Continually try training new units, in batches of 5
	if (queues.militaryUnit.length() < 6) {
		queues.militaryUnit.addItem(new UnitTrainingPlan(gameState, this.findBestNewUnit(gameState, queues), {
			"role" : "soldier"
		}, 5));
	}

	// Build more military buildings
	// TODO: make military building better
	if (gameState.countEntitiesWithType(gameState.applyCiv("units/{civ}_support_female_citizen")) > 30) {
		if (gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(this.bModerate[0]))
				+ queues.militaryBuilding.totalLength() < 1) {
			queues.militaryBuilding.addItem(new BuildingConstructionPlan(gameState, this.bModerate[0]));
		}
	}
	
	if (gameState.countEntitiesWithType(gameState.applyCiv("units/{civ}_support_female_citizen")) > 
			gameState.ai.modules[0].targetNumWorkers * 0.8){
		if (queues.militaryBuilding.totalLength() === 0){
			for (i in this.bAdvanced){
				if (gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(this.bAdvanced[i])) < 1){
					queues.militaryBuilding.addItem(new BuildingConstructionPlan(gameState, this.bAdvanced[i]));
				}
			}
		}
		
	}
	
	this.attackManager.execute(gameState, this);

	Engine.ProfileStop();
};
