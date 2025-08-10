import { addon } from './index.js'; // note the .js extension

const PORT = process.env.PORT || 1337;

addon.listen(PORT, function () {
  console.log(process.env.HOST_NAME);
  console.log(`Addon active on port ${PORT}.`);
});
