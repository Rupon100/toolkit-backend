const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: ["https://task-manager-f93cc.web.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

require("dotenv").config();
const port = process.env.PORT || 4080;

// gemini api
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cne3f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // collection create
    const classesCollection = client.db("StudyEase").collection("classes");
    const budgetCollection = client.db("StudyEase").collection("budgets");
    const plannerCollection = client.db("StudyEase").collection("plans");
    const quizesCollection = client.db("StudyEase").collection("quizes");

    // -------------------------------- classes ----------------------------

    // post classes to db
    app.post("/classes", async (req, res) => {
      const classInfo = req.body;
      const result = await classesCollection.insertOne(classInfo);
      res.status(200).send(result);
    });

    // get all classes
    app.get("/classes/:email", async (req, res) => {
      const email = req.params.email;

      const dayOrder = {
        Mon: 0,
        Tue: 1,
        Wed: 2,
        Thu: 3,
        Fri: 4,
        Sat: 5,
        Sun: 6,
      };

      const result = await classesCollection
        .aggregate([
          {
            $match: { user: email },
          },
          {
            $addFields: {
              dayIndex: {
                $switch: {
                  branches: Object.entries(dayOrder).map(([d, i]) => ({
                    case: { $eq: ["$day", d] },
                    then: i,
                  })),
                  default: 7,
                },
              },
            },
          },
          { $sort: { dayIndex: 1, startTime: 1 } }, // sort by day first, then startTime
        ])
        .toArray();

      res.status(200).send(result);
    });

    // delete an class
    app.delete("/class/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(filter);
      res.send(result);
    });

    // update class
    app.patch("/class/:id", async (req, res) => {
      const id = { _id: new ObjectId(req.params.id) };

      const { day, startTime, endTime } = req.body;

      const updateDoc = {
        $set: {
          day: day,
          startTime: startTime,
          endTime: endTime,
        },
      };

      const options = { upsert: true };

      const result = await classesCollection.updateOne(id, updateDoc, options);
      res.send(result);
    });

    // ----------------------- budget tracker apis-------------------------

    // add budget
    app.post("/budget", async (req, res) => {
      const body = req.body;
      const result = await budgetCollection.insertOne(body);
      res.send(result);
    });

    // get all budget
    app.get("/budget/:email", async (req, res) => {
      const email = { user: req.params.email };
      const result = await budgetCollection.find(email).toArray();
      res.send(result);
    });

    // get all budget information base on email
    app.get("/budget-graph/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const totals = await budgetCollection
          .aggregate([
            { $match: { user: email } },

            // Convert amount to number first
            {
              $addFields: {
                amountNum: { $toDouble: "$amount" },
              },
            },

            // Now group
            {
              $group: {
                _id: null,
                totalExpense: {
                  $sum: {
                    $cond: [
                      { $eq: ["$incomeType", "expense"] },
                      "$amountNum",
                      0,
                    ],
                  },
                },
                totalSaving: {
                  $sum: {
                    $cond: [
                      { $eq: ["$incomeType", "saving"] },
                      "$amountNum",
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .toArray();

        res.send(
          totals[0] || { totalIncome: 0, totalExpense: 0, totalSaving: 0 }
        );
      } catch (error) {
        res.status(500).send({ message: "Something went wrong" });
      }
    });

    // -------------------study planner---------------------
    // post a plan to db
    app.post("/plan", async (req, res) => {
      const body = req.body;
      const result = await plannerCollection.insertOne(body);
      res.send(result);
    });

    // get study plan by email
    app.get("/plan/:email", async (req, res) => {
      const result = await plannerCollection
        .find({ user: req?.params?.email })
        .toArray();
      res.send(result);
    });

    // update the plan progress
    app.put("/plan", async (req, res) => {
      const { id, value } = req.body;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: value,
        },
      };
      const result = await plannerCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // delete a completed task
    app.delete("/task/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await plannerCollection.deleteOne(query);
      res.send(result);
    });

    // -------------------- Exam Q&A ----------------------

    // get all the quiz answer
    app.get("/quizes", async (req, res) => {
      const { subject, difficulty } = req.query;

      const filter = {};
      if (subject) filter.subject = subject;
      if (difficulty) filter.difficulty = difficulty;
      

      try {
        const result = await quizesCollection.find(filter).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // quiz generate using Gemini API
    app.post("/quiz-ai", async (req, res) => {
      try {
        const { subject, difficulty } = req.body;

        // 2.5 flash fee tier
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // dynamic prompt for api
        const prompt = `Generate 5 multiple-choice quiz questions on subject ${subject}, which is ${difficulty} . For each question, provide four options and clearly indicate the correct answer, give different question and answer if ask same subject and difficulty. Format the response as a JSON object with a single "quiz" key containing an array of question objects. Each question object should have "question", "options" (an array of strings), and "correctAnswer" (a string).`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "");
        const quizData = JSON.parse(cleanedText);

        res.json(quizData);
      } catch (error) {
        res.send({ error: "Failed to generate quiz!" });
      }
    });



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send({ message: "wow crud is working here" });
});

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
