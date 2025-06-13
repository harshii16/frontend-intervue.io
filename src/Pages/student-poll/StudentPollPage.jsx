import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import io from "socket.io-client";
import "./StudentPollPage.css";
import stopwatch from "../../assets/stopwatch.svg";
import ChatPopover from "../../components/chat/ChatPopover";
import { useNavigate } from "react-router-dom";
import stars from "../../assets/spark.svg";

const StudentPollPage = () => {
  const [votes, setVotes] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState([]);
  const [pollId, setPollId] = useState("");
  const [kickedOut, setKickedOut] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

  // Initialize socket connection
  useEffect(() => {
    const apiUrl = "http://localhost:3000";
    console.log("Student connecting to socket server at:", apiUrl);
    
    // Create new socket connection
    socketRef.current = io(apiUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket']
    });
    
    socketRef.current.on("connect", () => {
      console.log("Student socket connected successfully with ID:", socketRef.current.id);
      setSocketConnected(true);
      setError("");
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Student socket connection error:", error);
      setSocketConnected(false);
      setError("Connection to server lost. Please refresh the page.");
    });

    socketRef.current.on("disconnect", () => {
      console.log("Student socket disconnected");
      setSocketConnected(false);
      setError("Connection to server lost. Please refresh the page.");
    });

    socketRef.current.on("pollCreated", (pollData) => {
      console.log("Student received poll data:", pollData);
      if (pollData && pollData.question) {
        setPollQuestion(pollData.question);
        setPollOptions(pollData.options || []);
        setVotes({});
        setSubmitted(false);
        setSelectedOption(null);
        setTimeLeft(pollData.timer || 60);
        setPollId(pollData._id);
      } else {
        console.error("Received invalid poll data:", pollData);
      }
    });

    socketRef.current.on("pollResults", (updatedVotes) => {
      console.log("Student received poll results:", updatedVotes);
      setVotes(updatedVotes);
    });

    socketRef.current.on("kickedOut", () => {
      console.log("Student was kicked out");
      setKickedOut(true);
      sessionStorage.removeItem("username");
      navigate("/kicked-out");
    });

    // Cleanup function
    return () => {
      console.log("Cleaning up student socket connection");
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [navigate]);

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    if (selectedOption && socketRef.current && socketConnected) {
      const username = sessionStorage.getItem("username");
      if (username) {
        try {
          socketRef.current.emit("submitAnswer", {
            username: username,
            option: selectedOption,
            pollId: pollId,
          }, (error) => {
            if (error) {
              console.error("Error submitting answer:", error);
              setError("Failed to submit answer. Please try again.");
            } else {
              console.log("Answer submitted successfully");
              setSubmitted(true);
            }
          });
        } catch (err) {
          console.error("Error emitting submitAnswer:", err);
          setError("Failed to submit answer. Please try again.");
        }
      } else {
        console.error("No username found in session storage!");
        setError("Session expired. Please log in again.");
      }
    }
  };

  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            setSubmitted(true);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeLeft, submitted]);

  const calculatePercentage = (count) => {
    if (totalVotes === 0) return 0;
    return (count / totalVotes) * 100;
  };

  return (
    <>
      <ChatPopover />
      {error && (
        <div className="alert alert-danger m-3" role="alert">
          {error}
        </div>
      )}
      {kickedOut ? (
        <div>kicked</div>
      ) : (
        <>
          {" "}
          {pollQuestion === "" && timeLeft === 0 && (
            <div className="d-flex justify-content-center align-items-center vh-100 w-75  mx-auto">
              <div className="student-landing-container text-center">
                <button className="btn btn-sm intervue-btn mb-5">
                  <img src={stars} className="px-1" alt="" />
                  Intervue Poll
                </button>
                <br />
                <div
                  className="spinner-border text-center spinner"
                  role="status"
                >
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h3 className="landing-title">
                  <b>Wait for the teacher to ask questions..</b>
                </h3>
                {!socketConnected && (
                  <p className="text-danger mt-3">
                    Not connected to server. Please refresh the page.
                  </p>
                )}
              </div>
            </div>
          )}
          {pollQuestion !== "" && (
            <div className="container mt-5 w-50">
              <div className="d-flex align-items-center mb-4">
                <h5 className="m-0 pe-5">Question</h5>
                <img
                  src={stopwatch}
                  width="15px"
                  height="auto"
                  alt="Stopwatch"
                />
                <span className="ps-2 ml-2 text-danger">{timeLeft}s</span>
              </div>
              <div className="card">
                <div className="card-body">
                  <h6 className="question py-2 ps-2 float-left rounded text-white">
                    {pollQuestion}?
                  </h6>
                  <div className="list-group mt-4">
                    {pollOptions.map((option) => (
                      <div
                        key={option.id}
                        className={`list-group-item rounded m-1 ${
                          selectedOption === option.text
                            ? "border option-border"
                            : ""
                        }`}
                        style={{
                          padding: "10px",
                          cursor:
                            submitted || timeLeft === 0
                              ? "not-allowed"
                              : "pointer",
                        }}
                        onClick={() => {
                          if (!submitted && timeLeft > 0) {
                            handleOptionSelect(option.text);
                          }
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <span
                            className={`ml-2 text-left ${
                              submitted ? "font-weight-bold" : ""
                            }`}
                          >
                            {option.text}
                          </span>
                          {submitted && (
                            <span className="text-right">
                              {Math.round(
                                calculatePercentage(votes[option.text] || 0)
                              )}
                              %
                            </span>
                          )}
                        </div>
                        {submitted && (
                          <div className="progress mt-2">
                            <div
                              className="progress-bar progress-bar-bg"
                              role="progressbar"
                              style={{
                                width: `${calculatePercentage(
                                  votes[option.text] || 0
                                )}%`,
                              }}
                              aria-valuenow={votes[option.text] || 0}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            ></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {!submitted && selectedOption && timeLeft > 0 && (
                <div className="d-flex  justify-content-end align-items-center">
                  <button
                    type="submit"
                    className="btn continue-btn my-3 w-25"
                    onClick={handleSubmit}
                  >
                    Submit
                  </button>
                </div>
              )}

              {submitted && (
                <div className="mt-5">
                  <h6 className="text-center">
                    Wait for the teacher to ask a new question...
                  </h6>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

export default StudentPollPage;
