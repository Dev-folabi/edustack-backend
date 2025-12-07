import axios from "axios";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const API_URL = "http://localhost:7000/api";

const TEST_USER = {
  username: "testuser_profile_verif",
  email: "testuser_profile@example.com",
  password: "password123",
};

async function verifyProfileEndpoints() {
  try {
    console.log("1. Setting up Test User...");

    // Cleanup existing test user if any
    await prisma.user.deleteMany({
      where: {
        OR: [{ username: TEST_USER.username }, { email: TEST_USER.email }],
      },
    });

    // Create new test user
    const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
    await prisma.user.create({
      data: {
        username: TEST_USER.username,
        email: TEST_USER.email,
        password: hashedPassword,
        hasVerifiedEmail: true,
      },
    });
    console.log("Test user created.");

    console.log("\n2. Logging in...");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      emailOrUsername: TEST_USER.username,
      password: TEST_USER.password,
    });

    if (!loginRes.data.success) {
      console.error("Login failed:", loginRes.data);
      return;
    }

    const token = loginRes.data.data.token;
    console.log("Login successful. Token obtained.");

    const config = {
      headers: { Authorization: `Bearer ${token}` },
    };

    console.log("\n3. Fetching Profile...");
    const profileRes = await axios.get(`${API_URL}/user/profile`, config);
    console.log("Profile fetched successfully.");
    console.log("User ID:", profileRes.data.data.id);
    console.log("Username:", profileRes.data.data.username);

    if (profileRes.data.data.username !== TEST_USER.username) {
      throw new Error("Fetched username does not match!");
    }

    console.log("\n4. Updating Profile (Username)...");
    const tempUsername = TEST_USER.username + "_updated";

    const updateRes = await axios.put(
      `${API_URL}/user/profile`,
      {
        username: tempUsername,
      },
      config
    );

    console.log("Profile updated successfully.");
    console.log("New Username:", updateRes.data.data.username);

    if (updateRes.data.data.username !== tempUsername) {
      console.error("Username update verification failed!");
    } else {
      console.log("Username update verified.");
    }

    console.log("\n5. Reverting Profile (Username)...");
    await axios.put(
      `${API_URL}/user/profile`,
      {
        username: TEST_USER.username,
      },
      config
    );
    console.log("Profile reverted successfully.");

    console.log("\nVerification Complete!");
  } catch (error: any) {
    console.error(
      "Verification failed:",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  } finally {
    await prisma.$disconnect();
  }
}

verifyProfileEndpoints();
