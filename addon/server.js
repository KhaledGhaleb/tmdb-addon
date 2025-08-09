import { addon } from './index.js'; // note the .js extension

const PORT = process.env.PORT || 1337;

addon.listen(PORT, function () {
  console.log(`http://127.0.0.1:${PORT}/`);
  console.log(`Addon active on port ${PORT}.`);
});
