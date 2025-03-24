const PetAdoption = artifacts.require("PetAdoption");

module.exports = function (deployer) {
    deployer.deploy(PetAdoption);
};
