const db = require('../db');

const saveResume = async ({ name, email, filename, text, analysis }) => {
  const result = await db.query(
    `INSERT INTO resumes (name, email, filename, text, analysis)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, email, filename, text, analysis]
  );
  return result.rows[0];
};

module.exports = { saveResume };
