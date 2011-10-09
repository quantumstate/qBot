Entity.prototype.deleteMetadata = function(id) {
	delete this._ai._entityMetadata[this.id()];
};

EntityTemplate.prototype.attackStrengths = function() {
	if (!this._template.Attack)
		return undefined;
	var ret = {};
	for ( var type in this._template.Attack)
		ret[type] = this._template.Attack[type];
	return ret;
};

EntityTemplate.prototype.armorStrengths = function() {
	if (!this._template.Armor)
		return undefined;

	return ret = this._template.Armor;
};