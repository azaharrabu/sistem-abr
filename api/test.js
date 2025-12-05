// api/test.js
export default function handler(req, res) {
  console.log('--- TEST API DEPLOYMENT SUCCESSFUL ---');
  res.status(200).json({ message: 'Test API is running successfully.' });
}