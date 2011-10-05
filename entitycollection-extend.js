EntityCollection.prototype.attack = function(unit)
{
	var unitId;
	if (typeOf(unit) === "Entity"){
		unitId = unit.id();
	}else{
		unitId = unit;
	}
	
	Engine.PostCommand({"type": "walk", "entities": this.toIdArray(), "target": unitId, "queued": false});
	return this;
};

function EntityCollectionFromIds(gameState, idList){
	var ents = {};
	for (i in idList){
		var id = idList[i];
		if (gameState.entities._entities[id]) {
			ents[id] = gameState.entities._entities[id];
		}
	}
	return new EntityCollection(gameState.ai, ents);
}