/*
 * Military strategy:
 *   * Try training an attack squad of a specified size
 *   * When it's the appropriate size, send it to attack the enemy
 *   * Repeat forever
 *
 */

var MilitaryAttackManager = function() {
	this.targetSquadSize = 10;
	this.squadTypes = [ "units/{civ}_infantry_spearman_b", "units/{civ}_infantry_javelinist_b"];
	
	//units
	this.uCivBasic = {};
	this.uCivModerate = {};
	this.uCivAdvanced = {};
	this.uCivBasic.hele = ["units/{civ}_infantry_spearman_b", "units/{civ}_infantry_javelinist_b", "units/{civ}_cavalry_swordsman_b"];
	this.uCivModerate.hele = ["units/{civ}_cavalry_javelinist_b", "units/{civ}_infantry_archer_b"];
	this.uCivAdvanced.hele = ["units/{civ}_champion_cavalry_mace", "units/{civ}_champion_infantry_mace", "units/{civ}_champion_infantry_polis", "units/{civ}_champion_ranged_polis"];
	
	this.uCivBasic.cart = ["units/{civ}_infantry_spearman_b", "units/{civ}_infantry_archer_b", "units/{civ}_cavalry_javelinist_b"];
	this.uCivModerate.cart= [];
	this.uCivAdvanced.cart = ["units/{civ}_champion_cavalry", "units/{civ}_infantry_swordsman_2_b", "units/{civ}_cavalry_spearman_b", "units/{civ}_infantry_javelinist_b", "units/{civ}_infantry_slinger_b", "units/{civ}_cavalry_swordsman_b", "units/{civ}_infantry_swordsman_b", "units/{civ}_cavalry_swordsman_2_b"];
	
	this.uCivBasic.celt = ["units/{civ}_infantry_spearman_b", "units/{civ}_infantry_javelinist_b", "units/{civ}_cavalry_javelinist_b"];
	this.uCivModerate.celt = ["units/{civ}_cavalry_swordsman_b"];
	this.uCivAdvanced.celt = ["units/{civ}_champion_cavalry_gaul", "units/{civ}_champion_infantry_gaul", "units/{civ}_champion_cavalry_brit", "units/{civ}_champion_infantry_brit"];
	 
	this.uCivBasic.iber = ["units/{civ}_infantry_swordsman_b", "units/{civ}_infantry_javelinist_b", "units/{civ}_cavalry_spearman_b"];
	this.uCivModerate.iber = ["units/{civ}_infantry_spearman_b", "units/{civ}_infantry_slinger_b"];
	this.uCivAdvanced.iber = ["units/{civ}_champion_cavalry", "units/{civ}_champion_infantry"];  
	
	//buildings
	this.bModerate = ["structures/{civ}_barracks"];
	
	this.bCivAdvanced = {};
	this.bCivAdvanced.hele = ["structures/{civ}_gymnasium"];
	this.bCivAdvanced.cart = ["structures/{civ}_fortress", "structures/{civ}_embassy_celtic", "structures/{civ}_embassy_celtic_iberian", "structures/{civ}_embassy_italiote"];
	
	this.minAttackSize = 20;
};


/**
 * Returns the unit type we should begin training. (Currently this is whatever
 * we have least of.)
 */
MilitaryAttackManager.prototype.findBestNewUnit = function(gameState) {
	// Count each type
	var types = [];
	for ( var tKey in this.squadTypes) {
		var t = this.squadTypes[tKey];
		types.push([ t, gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(t)) ]);
	}

	// Sort by increasing count
	types.sort(function(a, b) {
		return a[1] - b[1];
	});

	// TODO: we shouldn't return units that we don't have any
	// buildings capable of training

	return types[0][0];
};

MilitaryAttackManager.prototype.update = function(gameState, queues) {
	
	if (!("uBasic" in this)){
		var civ = gameState.playerData.civ; 
		if (civ in this.uCivBasic){
			this.uBasic = this.uCivBasic[civ];
			this.uModerate = this.uCivModerate[civ];
			this.uAdvanced = this.uCivAdvanced[civ];
			
			this.bAdvanced = this.bCivAdvanced[civ];
		}
	}
	
	// Pause for a minute before starting any work, to give the economy a
	// chance
	// to start up
	//if (gameState.getTimeElapsed() < 60 * 1000)
		//return;

	Engine.ProfileStart("military update");

	// Continually try training new units, in batches of 5
	if (queues.militaryUnit.totalLength() < 10){
		queues.militaryUnit.addItem(new UnitTrainingPlan(gameState, this.findBestNewUnit(gameState), {
			"role" : "attack-pending"
		}, 5));
	}
	
	//Measure enemy strength
	var isEnemy = gameState.playerData.isEnemy;
	var enemyStrength = [];
	var maxStrength = 0;
	for (var i = 1; i < isEnemy.length; i++){
		if (isEnemy[i]){
			//var enemyEntities = gameState.getEntitiesByPlayer(i);
			var count = 0;
			gameState.entities.forEach(function(ent) {
				if (ent.owner() === i && (ent.hasClass("CitizenSoldier") || ent.hasClass("Super"))){
					count ++;
				}
			});
			enemyStrength[i] = count;
			if (count > maxStrength){
				maxStrength = count;
			}
		}
		
	}
	//warn(uneval(enemyStrength));
	
	// Build more military buildings
	// TODO: make military buildings better
	//warn(gameState.countEntitiesWithType(gameState.applyCiv("units/{civ}_female_citizen")));
	if (gameState.countEntitiesWithType(gameState.applyCiv("units/{civ}_support_female_citizen")) > 30){
		if (gameState.countEntitiesAndQueuedWithType(gameState.applyCiv(this.bModerate[0])) + queues.militaryBuilding.totalLength() <= 2){
			queues.militaryBuilding.addItem(new BuildingConstructionPlan(gameState, this.bModerate[0]));
		}
	}
	
	
	this.targetSquadSize = maxStrength * 2;
	
	// Find the units ready to join the attack
	var pending = gameState.getOwnEntitiesWithRole("attack-pending");
	
	warn("Troops needed for attack: " + this.targetSquadSize + " Have: " + pending.length);

	// If we have enough units yet, start the attack
	if (pending.length >= this.targetSquadSize && pending.length >= this.minAttackSize) {
		// Find the enemy CCs we could attack
		var targets = gameState.entities.filter(function(ent) {
			return (ent.isEnemy() && ent.hasClass("CivCentre"));
		});

		// If there's no CCs, attack anything else that's critical
		if (targets.length == 0) {
			targets = gameState.entities.filter(function(ent) {
				return (ent.isEnemy() && ent.hasClass("ConquestCritical"));
			});
		}

		// If we have a target, move to it
		if (targets.length) {
			// Remove the pending role
			pending.forEach(function(ent) {
				ent.setMetadata("role", "attack");
			});

			var target = targets.toEntityArray()[0];
			var targetPos = target.position();

			// TODO: this should be an attack-move command
			pending.move(targetPos[0], targetPos[1]);
		}
	}

	Engine.ProfileStop();
};
