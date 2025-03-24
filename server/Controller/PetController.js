const Pet = require("../Model/PetModel");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { ethers } = require("ethers");
const { Web3 } = require("web3");  // Import Web3 properly in v4.x
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));


web3.eth.net
  .isListening()
  .then(() => console.log("✅ Web3 is connected to Ganache"))
  .catch((err) => console.error("❌ Web3 connection failed:", err));

// ✅ Contract Setup
const contractABIPath = path.join(__dirname, "../../Blockchain/build/contracts/PetAdoption.json");
const contractAddress = "0xD5cb33D324442ec54B2823166dB588A9FE31BDa9";

// ✅ Load contract ABI safely
const initializeContract = async () => {
  try {
    if (!fs.existsSync(contractABIPath)) {
      throw new Error(`❌ Contract ABI file not found at: ${contractABIPath}`);
    }
    const contractABI = require(contractABIPath);
    return new web3.eth.Contract(contractABI.abi, contractAddress);
  } catch (error) {
    console.error("❌ Error initializing contract:", error);
    return null;
  }
};

// ✅ Unlock Admin Account
const unlockAdminAccount = async () => {
  try {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) throw new Error("❌ No accounts found in Ganache!");

    const adminAccount = accounts[0];
    await web3.eth.personal.unlockAccount(adminAccount, "", 600);
    console.log("✅ Admin account unlocked:", adminAccount);
    return adminAccount;
  } catch (error) {
    console.error("❌ Error unlocking admin account:", error);
    return null;
  }
};

// ✅ Post a Pet Request
const postPetRequest = async (req, res) => {
  try {
    const { name, age, area, justification, email, phone, type } = req.body;
    console.log(req.body);
    const { filename } = req.file;

    const pet = await Pet.create({
      name,
      age,
      area,
      justification,
      email,
      phone,
      type,
      filename,
      status: 'Pending'
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASS
      }
  });
  
  const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Pet Submission Received - PawFinds',
      text: `Dear ${name},\n\nThank you for submitting your pet to PawFinds for adoption.\n\nWe have received your request, and our admin team is currently reviewing it. Once approved, your pet will be listed on our platform, making it available for adoption by our community of pet lovers.\n\nWe appreciate your patience and will notify you once your pet's listing is live.\n\nIf you have any questions or need assistance, feel free to contact us.\n\nBest regards,\nThe PawFinds Team`
  };
  
  try {
    
      await transporter.sendMail(mailOptions);
  } catch (error) {
    
      console.error('Error sending submission email:', error);
  }
  
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Function to listen for smart contract events
const listenForEvents = async () => {
  try {
    const petAdoptionContract = await initializeContract();
    if (!petAdoptionContract) {
      console.error("❌ Contract initialization failed while listening for events.");
      return;
    }

    petAdoptionContract.events.PetAdded({}, (error, event) => {
      if (error) {
        console.error("❌ Error listening for PetAdded event:", error);
      } else {
        console.log("📢 Event Received:", event.returnValues);
      }
    });
  } catch (error) {
    console.error("❌ Error setting up event listener:", error);
  }
};


// ✅ Approve Pet Adoption Request
const approveRequest = async (req, res) => {
  try {
    console.log("🔹 Approving pet adoption request...");
    const id = req.params.id;
    const { name, email, phone, status } = req.body;
    
    const pet = await Pet.findByIdAndUpdate(id, { name, email, phone, status }, { new: true });
    if (!pet) {
      return res.status(404).json({ error: "Pet not found" });
    }

    let userAddress;
    const newAccount = web3.eth.accounts.create();
    userAddress = newAccount.address;
    console.log("🔹 New Ethereum Address:", userAddress);

    const adminAccount = await unlockAdminAccount();
    if (!adminAccount) {
      return res.status(500).json({ error: "❌ Failed to unlock admin account" });
    }

    const petAdoptionContract = await initializeContract();
    if (!petAdoptionContract) {
      return res.status(500).json({ error: "❌ Contract initialization failed" });
    }

    try {
      await petAdoptionContract.methods
        .addPet(String(name), String(email), String(phone), String(status))
        .send({
          from: adminAccount, // ✅ Corrected: Pet is added by adopter
          gas: 3000000,
        });

      console.log("✅ Pet successfully added to the blockchain");

      listenForEvents(); // Start listening for events
    } catch (error) {
      console.error("❌ Blockchain transaction failed:", error);
      return res.status(500).json({ error: "❌ Failed to add pet to blockchain" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Pet is Now Live on PawFinds!",
      text: `Dear ${name} Owner,\n\nGreat news! Your pet has been approved and is now live on the PawFinds platform.\n\nBest regards,\nThe PawFinds Team`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json(pet);
  } catch (err) {
    console.error("❌ Error in approving request:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get All Pets
const allPets = async (reqStatus, req, res) => {
  try {
    const data = await Pet.find({ status: reqStatus }).sort({ updatedAt: -1 });
    if (data.length > 0) {
      res.status(200).json(data);
    } else {
      res.status(200).json({ error: 'No data found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete Pet Post
const deletePost = async (req, res) => {
  try {
    const id = req.params.id;
    const pet = await Pet.findByIdAndDelete(id);
    if (!pet) {
      return res.status(404).json({ error: "Pet not found" });
    }

    const filePath = path.join(__dirname, "../images", pet.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: pet.email,
      subject: "Pet Submission Removed - PawFinds",
      text: `Dear ${pet.name},\n\nWe wanted to inform you that your pet submission has been removed from the PawFinds platform by our admin team.\n\nBest regards,\nThe PawFinds Team`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Pet deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Export Controllers
module.exports = {
  postPetRequest,
  approveRequest,
  deletePost,
  allPets,
};
