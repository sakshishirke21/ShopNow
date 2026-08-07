require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User } = require("../src/models");
async function run() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password || password.length < 12)
    throw new Error(
      'Usage: npm run create-admin -- "Name" email@example.com password-at-least-12-chars',
    );
  await mongoose.connect(process.env.MONGODB_URI);
  if (await User.exists({ email: email.toLowerCase() }))
    throw new Error("An account already exists for this email.");
  await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin",
  });
  console.log("Administrator created.");
  await mongoose.disconnect();
}
run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
