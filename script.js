'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputLap = document.querySelector('.form__input--lap');
const optCadence = document.querySelector('#cadence');
const optElev = document.querySelector('#elev');
const optLap = document.querySelector('#lap');
const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const btnCloseModal = document.querySelector('.close-modal');
const modalCancel = document.querySelector('.modal-cancel');
const modalDelete = document.querySelector('.modal-delete');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, long]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / this.duration;
    return this.speed;
  }
}

class Swimming extends Workout {
  type = 'swimming';
  constructor(coords, distance, duration, lap) {
    super(coords, distance, duration);
    this.lap = lap;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / this.duration;
    return this.speed;
  }
}

const run1 = new Running([39, -12], 5.2, 24, 178);
const cycling1 = new Cycling([39, -12], 27, 95, 523);
const swimming1 = new Swimming([39, -12], 27, 95, 523);
// console.log(run1);
// console.log(cycling1);

/////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomLevel = 14;
  #mapEvent;
  #workouts = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handler
    form.addEventListener('submit', this._newWorkOut.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this.deleteWorkout.bind(this));
    btnCloseModal.addEventListener('click', this.closeModal);
    overlay.addEventListener('click', this.closeModal);
    modalCancel.addEventListener('click', this.closeModal);
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert(`Could net get your position`);
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(latitude, longitude);
    // console.log(
    //   `https://www.google.com/maps/@${latitude},${longitude},18.14z?hl=vi-VN`
    // );

    const coords = [latitude, longitude];
    // console.log(latitude, longitude);

    // console.log(this);
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    L.marker(coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          content: '🏠 Home ',
          autoClose: false,
          closeOnClick: false,
        })
      )
      .openPopup();

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Render marker after map load
    this.#workouts.forEach(work => this._renderWorkout(work));

    this.#workouts.forEach(work => this._renderWorkoutMarker(work));

    this.#map.setView(coords, this.#mapZoomLevel);
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    // Display form
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Emty the input
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
      inputLap.value =
        '';

    // hide form
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField(e) {
    const active = e.target.value;
    if (active === 'running') {
      optCadence.classList.remove('hidden');
      optElev.classList.add('hidden');
      optLap.classList.add('hidden');
    } else if (active === 'cycling') {
      optCadence.classList.add('hidden');
      optElev.classList.remove('hidden');
      optLap.classList.add('hidden');
    } else if (active === 'swimming') {
      optCadence.classList.add('hidden');
      optElev.classList.add('hidden');
      optLap.classList.remove('hidden');
    }
  }

  _newWorkOut(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault(); // prevent submit
    // console.log(this);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running obj
    if (type === `running`) {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert(`Inputs have to be positive numbers!`);

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling obj
    if (type === `cycling`) {
      const elevation = +inputElevation.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert(`Inputs have to be positive numbers!`);

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // If workout swimming, create swimming obj
    if (type === `swimming`) {
      const lap = +inputLap.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, lap) ||
        !allPositive(distance, duration)
      )
        return alert(`Inputs have to be positive numbers!`);

      workout = new Swimming([lat, lng], distance, duration, lap);
    }

    this.#map.setView(workout.coords, this.#mapZoomLevel);
    // Add new obj to workout array
    this.#workouts.push(workout);
    // console.log(workout);

    // Render workout on map as a maker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage(workout);
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${
          workout.type === 'running'
            ? '🏃‍♂️'
            : workout.type === 'cycling'
            ? '🚴'
            : '🏊'
        } ${workout.description}`
      )
      .openPopup();

    // this.#map.setView(workout.coords, this.#mapZoomLevel);
    // console.log(this);
  }

  _renderWorkout(workout) {
    let html = `
      <div class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running'
              ? '🏃‍♂️'
              : workout.type === 'cycling'
              ? '🚴'
              : '🏊'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        <div class="workout__delete__btn">
            <span class="workout__delete">Delete</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        <div class="workout__delete__btn">
          <span class="workout__delete">Delete</span>
    </div>
      </li>
      `;

    if (workout.type === 'swimming') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
         <span class="workout__value">${workout.speed.toFixed(1)}</span>
         <span class="workout__unit">km/min</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🌊</span>
          <span class="workout__value">${workout.lap}</span>
          <span class="workout__unit">lap</span>
        </div>
        <div class="workout__delete__btn">
          <span class="workout__delete">Delete</span>
        </div>
      </li>
      `;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    // console.log(workoutEl);

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    // console.log(workoutEl.dataset.id);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    this._hideForm();

    // using the public interface
    // workout.click();
    // console.log(workout);
  }

  _setLocalStorage(workout) {
    localStorage.setItem(`${workout.id}`, JSON.stringify(workout));
  }

  _getLocalStorage() {
    // const data = JSON.parse(localStorage.getItem('workouts'));
    const data = [];
    for (let info of Object.keys(localStorage)) {
      data.push(JSON.parse(localStorage.getItem(info)));
    }

    // console.log(data);

    if (!data) return;

    this.#workouts = data;

    // console.log(this.#workouts);

    // Error because #map was not defined
    // this.#workouts.forEach(work => this._renderWorkout(work));

    // this.#workouts.forEach(work => this._renderWorkoutMarker(work));
  }

  reset() {
    // localStorage.removeItem('workouts');
    localStorage.clear();
    location.reload();
  }

  deleteWorkout(e) {
    const workoutEl = e.target.closest('.workout');

    if (e.target.className === 'workout__delete') {
      this.openModal();
      modalDelete.addEventListener('click', function () {
        localStorage.removeItem(`${workoutEl.dataset.id}`);
        location.reload();
      });
    }
  }

  openModal() {
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }

  closeModal() {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
  }
}

const app = new App();
// app._getPosition();
