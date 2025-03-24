// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract PetAdoption {
    struct Pet {
        uint id;
        string name;
        string email;
        string phone;
        string status;
        bool isAdopted;
        address adopter;
    }

    Pet[] public pets;
    uint public petCount = 0;
    address public admin;

    // 📢 Define an event to log new pet additions
    event PetAdded(uint id, string name, string email, string phone, string status);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    function addPet(
        string memory _name,
        string memory _email,
        string memory _phone,
        string memory _status
    ) public onlyAdmin {
        require(bytes(_name).length > 0, "Pet name cannot be empty");
        require(bytes(_email).length > 0, "Email cannot be empty");
        require(bytes(_phone).length > 0, "Phone number cannot be empty");
        require(bytes(_status).length > 0, "Status cannot be empty");

        petCount++;

        pets.push(Pet({
            id: petCount,
            name: _name,
            email: _email,
            phone: _phone,
            status: _status,
            isAdopted: false,
            adopter: address(0)
        }));

        // 📢 Emit an event after adding a pet
        emit PetAdded(petCount, _name, _email, _phone, _status);
    }
}
