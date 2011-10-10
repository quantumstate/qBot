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
	this.uCivCitizenSoldier= {};
	this.uCivAdvanced = {};
	this.uCivSiege = {};
	
	this.uCivCitizenSoldier.hele = [ "units/hele_infantry_spearman_b", "units/hele_infantry_javelinist_b", "units/hele_infantry_archer_b" ];
	this.uCivAdvanced.hele = [ "units/hele_cavalry_swordsman_b", "units/hele_cavalry_javelinist_b", "units/hele_champion_cavalry_mace", "units/hele_champion_infantry_mace", "units/hele_champion_infantry_polis", "units/hele_champion_ranged_polis" , "units/thebes_sacred_band_hoplitai", "units/thespian_melanochitones","units/sparta_hellenistic_phalangitai", "units/thrace_black_cloak"];
	this.uCivSiege.hele = [ "units/hele_mechanical_siege_oxybeles", "units/hele_mechanical_siege_lithobolos" ];

	this.uCivCitizenSoldier.cart = [ "units/cart_infantry_spearman_b", "units/cart_infantry_archer_b" ];
	this.uCivAdvanced.cart = [ "units/cart_cavalry_javelinist_b", "units/cart_champion_cavalry", "units/cart_infantry_swordsman_2_b", "units/cart_cavalry_spearman_b", "units/cart_infantry_javelinist_b", "units/cart_infantry_slinger_b", "units/cart_cavalry_swordsman_b", "units/cart_infantry_swordsman_b", "units/cart_cavalry_swordsman_2_b", "units/cart_sacred_band_cavalry"];
	this.uCivSiege.cart = ["units/cart_mechanical_siege_ballista", "units/cart_mechanical_siege_oxybeles"];
	
	this.uCivCitizenSoldier.celt = [ "units/celt_infantry_spearman_b", "units/celt_infantry_javelinist_b" ];
	this.uCivAdvanced.celt = [ "units/celt_cavalry_javelinist_b", "units/celt_cavalry_swordsman_b", "units/celt_champion_cavalry_gaul", "units/celt_champion_infantry_gaul", "units/celt_champion_cavalry_brit", "units/celt_champion_infantry_brit", "units/celt_fanatic" ];
	this.uCivSiege.celt = ["units/celt_mechanical_siege_ram"];

	this.uCivCitizenSoldier.iber = [ "units/iber_infantry_spearman_b", "units/iber_infantry_slinger_b", "units/iber_infantry_swordsman_b", "units/iber_infantry_javelinist_b" ];
	this.uCivAdvanced.iber = ["units/iber_cavalry_spearman_b", "units/iber_champion_cavalry", "units/iber_champion_infantry" ];
	this.uCivSiege.iber = ["units/iber_mechanical_siege_ram"];

	// buildings
	this.bModerate = [ "structures/{civ}_barracks" ]; //same for all civs

	this.bCivAdvanced = {};
	this.bCivAdvanced.hele = [ "structures/{civ}_gymnasion", "structures/{civ}_fortress" ];
	this.bCivAdvanced.cart = [ "structures/{civ}_fortress", "structures/{civ}_embassy_celtic", "structures/{civ}_embassy_iberian", "structures/{civ}_embassy_italiote" ];
	this.bCivAdvanced.celt = [ "structures/{civ}_kennel", "structures/{civ}_fortress_b", "structures/{civ}_fortress_g" ];
	this.bCivAdvanced.iber = [ "structures/{civ}_fortress" ];

	this.attackManager = new WalkToCC();
};

MilitaryAttackManager.prototype.init = function(gameState) {
	var civ = gameState.playerData.civ;
	if (civ in this.uCivCitizenSoldier) {
		this.uCitizenSoldier = this.uCivCitizenSoldier[civ];
		this.uAdvanced = this.uCivAdvanced[civ];
		this.uSiege = this.uCivSiege[civ];

		this.bAdvanced = this.bCivAdvanced[civ];
	}
};


/**
 * @param (GameState) gameState
 * @returns array of soldiers for which training buildings exist
 */
MilitaryAttackManager.prototype.findTrainableUnits = function(gameState, soldierTypes){
	var ret = [];
	gameState.getOwnEntities().forEach(function(ent) {
		var trainable = ent.trainableEntities();
		for (i in trainable){
			//var template = new EntityTemplate(gameState.ai.GetTemplate(trainable[i]));
			if (soldierTypes.indexOf(trainable[i]) !== -1){
				if (ret.indexOf(trainable[i]) === -1){
					ret.push(trainable[i]);
				}
			} 
			/*if (template.hasClass("CitizenSoldier") || template.hasClass("Super")){
				if (ret.indexOf(trainable[i]) === -1){
					ret.push(trainable[i]);
				}
			}*/
		}
		return true;
	});
	return ret;
};

/**
 * Returns the unit type we should begin training. (Currently this is whatever
 * we have least of.)
 */
MilitaryAttackManager.prototype.findBestNewUnit = function(gameState, queue, soldierTypes) {
	var units = this.findTrainableUnits(gameState, soldierTypes);
	// Count each type
	var types = [];
	for ( var tKey in units) {
		var t = units[tKey];
		types.push([t, gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(t))
						+ queue.countAllByType(gameState.applyCiv(t)) ]);
	}

	// Sort by increasing count
	types.sort(function(a, b) {
		return a[1] - b[1];
	});

	if (types.length === 0){
		return false;
	}
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
		gameState.entities.forEach(function(ent) {
			if (gameState.playerData.isEnemy[ent.owner()]
					&& (ent.hasClass("CitizenSoldier") || ent.hasClass("Super"))
					&& ent.position()) {
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
		this.entity(i).setMetadata("role", "soldier");
		count++;
		if (count >= n) {
			break;
		}
	}
	return ret;
};

// Takes a single unit id, and marks it unassigned
MilitaryAttackManager.prototype.unassignUnit = function(unit){
	this.unassigned[unit] = true;
	this.assigned[unit] = false;
};

// Takes an array of unit id's and marks all of them unassigned 
MilitaryAttackManager.prototype.unassignUnits = function(units){
	for (i in units){
		this.unassigned[unit[i]] = true;
		this.assigned[unit[i]] = false;
	}
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
						this.unassignUnit(attacker.id());
					}
				}
			}
		}
	}
};

// Takes an entity id and returns an entity object or false if there is no entity with that id
// Also sends a debug message warning if the id has no entity
MilitaryAttackManager.prototype.entity = function(id) {
	if (this.gameState.entities._entities[id]) {
		return new Entity(this.gameState.ai, this.gameState.entities._entities[id]);
	}else{
		debug("Entity " + id + " requested does not exist");
	}
	return false;
};

// Returns the military strength of unit 
MilitaryAttackManager.prototype.getUnitStrength = function(ent){
	var strength = 0.0;
	var attackStrength = ent.attackStrengths();
	var armorStrength = ent.armorStrengths();
	var hp = 2 * ent.hitpoints() / (160 + 1*ent.maxHitpoints()); //100 = typical number of hitpoints
	for (var type in attackStrength) {
		for (var str in attackStrength[type]) {
			var val = parseFloat(attackStrength[type][str]);
			switch (str) {
				case "Crush":
					strength += (val * 0.085) / 3;
					break;
				case "Hack":
					strength += (val * 0.075) / 3;
					break;
				case "Pierce":
					strength += (val * 0.065) / 3;
					break;
				case "MaxRange":
					strength += (val * 0.0125) ;
					break;
				case "RepeatTime":
					strength += (val / 100000);
					break;
				case "PrepareTime":
					strength -= (val / 100000);
					break;
				case "ProjectileSpeed":
					strength += (val / 1000);
					break;
			}
		}
	}
	for (var str in armorStrength) {
		var val = parseFloat(armorStrength[str]);
		switch (str) {
			case "Crush":
				strength += (val * 0.085) / 3;
				break;
			case "Hack":
				strength += (val * 0.075) / 3;
				break;
			case "Pierce":
				strength += (val * 0.065) / 3;
				break;
		}
	}
	return strength * hp;
};

// Returns the  strength of the available units of ai army
MilitaryAttackManager.prototype.measureAvailableStrength = function(){
	var  strength = 0.0;
	for (i in this.unassigned){
		if (this.unassigned[i]){
			strength += this.getUnitStrength(this.entity(i));
		}
	}
	return strength;
};

// Returns the number of units in the largest enemy army
MilitaryAttackManager.prototype.measureEnemyCount = function(gameState){
	// Measure enemy units
	var isEnemy = gameState.playerData.isEnemy;
	var enemyCount = [];
	var maxCount = 0;
	//loop through every player then look for their soldiers if they are an enemy
	for ( var i = 1; i < isEnemy.length; i++) {
		if (isEnemy[i]) {
			var count = 0;
			gameState.entities.forEach(function(ent) {
				if (ent.owner() === i && (ent.hasClass("CitizenSoldier") || ent.hasClass("Super"))) {
					count++;
				}
			});
			enemyCount[i] = count;
			if (count > maxCount) {
				maxCount = count;
			}
		}
	}
	
	return maxCount;
};

// Returns the strength of the largest enemy army
MilitaryAttackManager.prototype.measureEnemyStrength = function(gameState){
	// Measure enemy strength
	var isEnemy = gameState.playerData.isEnemy;
	var enemyStrength = [];
	var maxStrength = 0;
	var self = this;
	//loop through every player then look for their soldiers if they are an enemy
	for ( var i = 1; i < isEnemy.length; i++) {
		if (isEnemy[i]) {
			var strength = 0.0;
			gameState.entities.forEach(function(ent) {
				if (ent.owner() === i && (ent.hasClass("CitizenSoldier") || ent.hasClass("Super"))) {
					strength += self.getUnitStrength(ent);
				}
			});
			enemyStrength[i] = strength;
			if (strength > maxStrength) {
				maxStrength = strength;
			}
		}
	}
	
	return maxStrength;
};

// Adds towers to the defenceBuilding queue
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
	if (queues.citizenSoldier.length() < 6) {
		var newUnit = this.findBestNewUnit(gameState, queues.citizenSoldier, this.uCitizenSoldier);
		if (newUnit){
			queues.citizenSoldier.addItem(new UnitTrainingPlan(gameState, newUnit, {
				"role" : "soldier"
			}, 5));
		}
	}
	if (queues.advancedSoldier.length() < 2) {
		var newUnit = this.findBestNewUnit(gameState, queues.advancedSoldier, this.uAdvanced);
		if (newUnit){
			queues.advancedSoldier.addItem(new UnitTrainingPlan(gameState, newUnit, {
				"role" : "soldier"
			}, 5));
		}
	}
	if (queues.siege.length() < 4) {
		var newUnit = this.findBestNewUnit(gameState, queues.siege, this.uSiege);
		if (newUnit){
			queues.siege.addItem(new UnitTrainingPlan(gameState, newUnit, {
				"role" : "soldier"
			}, 2));
		}
	}

	// Build more military buildings
	// TODO: make military building better
	if (gameState.countEntitiesWithType(gameState.applyCiv("units/{civ}_support_female_citizen")) > 30) {
		if (gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(this.bModerate[0]))
				+ queues.militaryBuilding.totalLength() < 1) {
			queues.militaryBuilding.addItem(new BuildingConstructionPlan(gameState, this.bModerate[0]));
		}
	}
	//build advanced military buildings
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
	
	// Set unassigned to be workers
	for (i in this.unassigned){
		if (this.entity(i).hasClass("CitizenSoldier") && ! this.entity(i).hasClass("Cavalry")){
			this.entity(i).setMetadata("role", "worker");
		}
	}

	Engine.ProfileStop();
};
